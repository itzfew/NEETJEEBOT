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
import { logMessage, getLogFilePath } from './utils/logMessages';
import fs from 'fs';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';
const ADMIN_ID = 6930703214;
const BOT_USERNAME = 'SearchNEETJEEBot';

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

// /add command
bot.command('add', async (ctx) => {
  if (!isPrivateChat(ctx.chat.type)) return;

  await ctx.reply('Please share through this bot: @NeetAspirantsBot', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Open Bot', url: 'https://t.me/NeetAspirantsBot' }]],
    },
  });
});

// /about
bot.command('about', async (ctx) => {
  if (!isPrivateChat(ctx.chat.type)) return;
  await about()(ctx);
});

// /start
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

// /users (admin)
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

// /logs YYYY-MM-DD (admin)
bot.command('logs', async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return ctx.reply('Unauthorized');

  const input = ctx.message.text.split(' ')[1];
  if (!input) return ctx.reply('Please provide a date in YYYY-MM-DD format, e.g., /logs 2025-05-18');

  const logFile = getLogFilePath(input);
  if (!logFile) return ctx.reply(`No logs found for ${input}`);

  await ctx.replyWithDocument({
    source: fs.createReadStream(logFile),
    filename: `logs-${input}.txt`,
  });
});

// /broadcast
setupBroadcast(bot);

// --- Study Search ---
bot.on('text', async (ctx, next) => {
  let text = ctx.message?.text?.trim();
  if (!text) return;

  const chatType = ctx.chat?.type || '';
  const isGroup = chatType === 'group' || chatType === 'supergroup';
  const isPrivate = chatType === 'private';

  const mentionedEntity = ctx.message.entities?.find(
    (entity) =>
      entity.type === 'mention' &&
      text.slice(entity.offset, entity.offset + entity.length).toLowerCase() === `@${BOT_USERNAME.toLowerCase()}`
  );

  if (isPrivate || (isGroup && mentionedEntity)) {
    if (mentionedEntity) {
      text = text.replace(`@${BOT_USERNAME}`, '').trim();
      ctx.message.text = text;
    }

    await studySearch()(ctx);
  } else {
    await next();
  }
});

// New chat members
bot.on('new_chat_members', async (ctx) => {
  for (const member of ctx.message.new_chat_members) {
    const name = member.first_name || 'there';

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

// --- Message Logging & Save User ---
bot.on('message', async (ctx) => {
  const chat = ctx.chat;
  if (!chat?.id || !isPrivateChat(chat.type)) return;

  const msg = ctx.message;
  const user = ctx.from;
  const text = msg?.text || '<non-text message>';
  const timestamp = new Date((msg?.date || Math.floor(Date.now() / 1000)) * 1000).toISOString();

  logMessage({
    chatId: chat.id,
    username: user?.username,
    firstName: user?.first_name,
    text,
    timestamp,
  });

  const alreadyNotified = await saveToSheet(chat);
  console.log(`Saved chat ID: ${chat.id} (${chat.type})`);

  if (chat.id !== ADMIN_ID && !alreadyNotified) {
    await ctx.telegram.sendMessage(
      ADMIN_ID,
      `*New user interacted!*\n\n*Name:* ${user?.first_name || 'Unknown'}\n*Username:* ${user?.username ? `@${user.username}` : 'N/A'}\n*Chat ID:* ${chat.id}\n*Type:* ${chat.type}`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Refresh users (inline button)
bot.action('refresh_users', async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  try {
    const chatIds = await fetchChatIdsFromSheet();
    await ctx.editMessageText(`📊 Total users: ${chatIds.length} (refreshed)`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: 'Refresh', callback_data: 'refresh_users' }]],
      },
    });
    await ctx.answerCbQuery('Refreshed!');
  } catch (err) {
    console.error('Failed to refresh user count:', err);
    await ctx.answerCbQuery('Refresh failed');
  }
});

// --- Vercel Export ---
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};

if (ENVIRONMENT !== 'production') {
  development(bot);
}
