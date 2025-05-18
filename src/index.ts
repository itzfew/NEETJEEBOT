import { Telegraf } from 'telegraf';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { saveToSheet } from './utils/saveToSheet';
import { fetchChatIdsFromSheet } from './utils/chatStore';
import { about } from './commands/about';
import { greeting, checkMembership } from './text/greeting';
import { production, development } from './core';
import { isPrivateChat } from './utils/groupSettings';
import { setupBroadcast } from './commands/broadcast';
import { studySearch } from './commands/study';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';
const ADMIN_ID = 6930703214;
const BOT_USERNAME = 'SearchNEETJEEBot'; // Replace with your actual bot username (without @)

if (!BOT_TOKEN) throw new Error('BOT_TOKEN not provided!');
console.log(`Running bot in ${ENVIRONMENT} mode`);

const bot = new Telegraf(BOT_TOKEN);

// Middleware to restrict private command usage
bot.use(async (ctx, next) => {
  if (ctx.chat && isPrivateChat(ctx.chat.type)) {
    const isAllowed = await checkMembership(ctx);
    if (!isAllowed) return;
  }
  await next();
});
// Private Only: /add command with "Open Bot" button
bot.command('add', async (ctx) => {
  if (!isPrivateChat(ctx.chat.type)) return;

  await ctx.reply('Please share through this bot: @NeetAspirantsBot', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Open Bot', url: 'https://t.me/NeetAspirantsBot' }
        ]
      ]
    }
  });
});

// --- Commands (Private Only) ---
bot.command('about', async (ctx) => {
  if (!isPrivateChat(ctx.chat.type)) return;
  await about()(ctx);
});

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

// Admin: /users
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

// Admin: /broadcast
setupBroadcast(bot);

// --- Study Search (Private + Mention in Groups Only) ---
bot.on('text', async (ctx, next) => {
  let text = ctx.message?.text?.trim();
  if (!text) return;

  const chatType = ctx.chat?.type || '';
  const isGroup = chatType === 'group' || chatType === 'supergroup';
  const isPrivate = chatType === 'private';

  // In groups, only respond if the bot is mentioned
  const mentionedEntity = ctx.message.entities?.find(
    (entity) =>
      entity.type === 'mention' &&
      text.slice(entity.offset, entity.offset + entity.length).toLowerCase() === `@${BOT_USERNAME.toLowerCase()}`
  );

  if (isPrivate || (isGroup && mentionedEntity)) {
    // Remove mention from message text for clean search
    if (mentionedEntity) {
      text = text.replace(`@${BOT_USERNAME}`, '').trim();
      ctx.message.text = text; // Update text for studySearch to use
    }

    await studySearch()(ctx);
  } else {
    await next();
  }
});

bot.on('new_chat_members', async (ctx) => {
  for (const member of ctx.message.new_chat_members) {
    const name = member.first_name || 'there';

    // Welcome only users (skip bot itself)
    if (member.username === ctx.botInfo.username) {
      await ctx.reply(
        `*Thanks for adding me!*\n\nType *@${BOT_USERNAME} mtg bio* to get study material.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply(
        `*Hi ${name}!* Welcome! \n\nType *@${BOT_USERNAME} mtg bio* to get study material.`,
        { parse_mode: 'Markdown' }
      );
    }
  }
});

// --- Message Tracker (Private Only) ---
bot.on('message', async (ctx) => {
  const chat = ctx.chat;
  if (!chat?.id || !isPrivateChat(chat.type)) return;

  const alreadyNotified = await saveToSheet(chat);
  console.log(`Saved chat ID: ${chat.id} (${chat.type})`);

  if (chat.id !== ADMIN_ID && !alreadyNotified) {
    const user = ctx.from;
    const name = user?.first_name || 'Unknown';
    const username = user?.username ? `@${user.username}` : 'N/A';
    await ctx.telegram.sendMessage(
      ADMIN_ID,
      `*New user interacted!*\n\n*Name:* ${name}\n*Username:* ${username}\n*Chat ID:* ${chat.id}\n*Type:* ${chat.type}`,
      { parse_mode: 'Markdown' }
    );
  }
});

// --- Callback: refresh users ---
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

// --- Vercel Export ---
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};

if (ENVIRONMENT !== 'production') {
  development(bot);
}
