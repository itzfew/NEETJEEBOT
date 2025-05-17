import { Telegraf } from 'telegraf';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { saveToSheet, appendRowToSheet } from './utils/saveToSheet';
import { fetchChatIdsFromSheet } from './utils/chatStore';
import { about } from './commands/about';
import { greeting, checkMembership } from './text/greeting';
import { production, development } from './core';
import { isPrivateChat } from './utils/groupSettings';
import { setupBroadcast } from './commands/broadcast';
import { studySearch } from './commands/study';
import { getLogsFromSheet } from './utils/logStore';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';
const ADMIN_ID = 6930703214;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN not provided!');
console.log(`Running bot in ${ENVIRONMENT} mode`);

const bot = new Telegraf(BOT_TOKEN);

// --- Middleware: Group membership restriction ---
bot.use(async (ctx, next) => {
  if (ctx.chat && isPrivateChat(ctx.chat.type)) {
    const isAllowed = await checkMembership(ctx);
    if (!isAllowed) return;
  }
  await next();
});

// --- /about command ---
bot.command('about', async (ctx) => {
  if (!isPrivateChat(ctx.chat.type)) return;
  await about()(ctx);
});

// --- /logs command (admin only) ---
bot.command('logs', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return;

  try {
    const logs = await getLogsFromSheet();
    const latest = logs.slice(-10).reverse().map(
      (log) => `• [${log.username || 'N/A'}]: ${log.message}`
    ).join('\n');

    await ctx.reply(`🗂 Latest Messages:\n\n${latest || 'No logs found.'}`);
  } catch (err) {
    console.error('Error in /logs:', err);
    await ctx.reply('❌ Failed to fetch logs.');
  }
});

// --- /start command ---
bot.command('start', async (ctx) => {
  if (!isPrivateChat(ctx.chat.type)) return;

  const user = ctx.from;
  const chat = ctx.chat;

  await greeting()(ctx);

  const alreadyNotified = await saveToSheet(chat);
  console.log(`Saved chat ID: ${chat.id} (${chat.type})`);

  if (chat.id !== ADMIN_ID && !alreadyNotified) {
    const name = user?.first_name || 'Unknown';
    const username = user?.username ? `@${user.username}` : 'N/A';
    await ctx.telegram.sendMessage(
      ADMIN_ID,
      `*New user started the bot!*\n\n*Name:* ${name}\n*Username:* ${username}\n*Chat ID:* ${chat.id}\n*Type:* ${chat.type}`,
      { parse_mode: 'Markdown' }
    );
  }
});

// --- /users command ---
bot.command('users', async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return ctx.reply('You are not authorized.');
  try {
    const chatIds = await fetchChatIdsFromSheet();
    await ctx.reply(`📊 Total users: ${chatIds.length}`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: 'Refresh', callback_data: 'refresh_users' }]],
      },
    });
  } catch (err) {
    console.error('Error fetching user count:', err);
    await ctx.reply('❌ Unable to fetch user count.');
  }
});

// --- /broadcast command ---
setupBroadcast(bot);

// --- Study material search ---
bot.on('text', async (ctx, next) => {
  const text = ctx.message?.text?.trim();
  if (!text) return;

  const keywords = ['mtg', 'notes', 'bio', 'neet', 'allen', 'question', 'physics'];
  const isLikelyStudySearch = keywords.some(k => text.toLowerCase().includes(k)) || text.length > 3;

  if (isLikelyStudySearch) {
    await studySearch()(ctx);
  } else {
    await next();
  }
});

// --- Welcome new group members ---
bot.on('new_chat_members', async (ctx) => {
  for (const member of ctx.message.new_chat_members) {
    if (member.username === ctx.botInfo.username) {
      await ctx.reply('Thanks for adding me! Send any study-related keyword (like "mtg bio") to get materials.');
    }
  }
});

// --- Track all private messages (and log to sheet) ---
bot.on('message', async (ctx) => {
  const chat = ctx.chat;
  if (!chat?.id || !isPrivateChat(chat.type)) return;

  const user = ctx.from;
  const text = ctx.message?.text || '[non-text message]';

  await appendRowToSheet('Logs', [
    new Date().toISOString(),
    user?.id || '',
    user?.username || '',
    text
  ]);

  const alreadyNotified = await saveToSheet(chat);
  console.log(`Saved chat ID: ${chat.id} (${chat.type})`);

  if (chat.id !== ADMIN_ID && !alreadyNotified) {
    const name = user?.first_name || 'Unknown';
    const username = user?.username ? `@${user.username}` : 'N/A';
    await ctx.telegram.sendMessage(
      ADMIN_ID,
      `*New user interacted!*\n\n*Name:* ${name}\n*Username:* ${username}\n*Chat ID:* ${chat.id}\n*Type:* ${chat.type}`,
      { parse_mode: 'Markdown' }
    );
  }
});

// --- Refresh user count ---
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (data === 'refresh_users' && ctx.from?.id === ADMIN_ID) {
    try {
      const chatIds = await fetchChatIdsFromSheet();
      await ctx.editMessageText(`📊 Total users: ${chatIds.length}`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: 'Refresh', callback_data: 'refresh_users' }]],
        },
      });
    } catch (err) {
      console.error('Error refreshing users:', err);
      await ctx.answerCbQuery('Failed to refresh.');
    }
  } else {
    await ctx.answerCbQuery('Unknown action');
  }
});

// --- Export for Vercel ---
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};

if (ENVIRONMENT !== 'production') {
  development(bot);
}
