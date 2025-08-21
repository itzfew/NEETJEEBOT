import { Telegraf, Context } from 'telegraf';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleTranslateCommand } from './commands/translate';
import { about } from './commands/about';
import { greeting } from './text/greeting';
import { production, development } from './core';
import { studySearch } from './commands/study';

// Helper to check private chat type
const isPrivateChat = (type?: string) => type === 'private';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';
const ADMIN_ID = 6930703214;
const BOT_USERNAME = 'SearchNEETJEEBot';

if (!BOT_TOKEN) throw new Error('BOT_TOKEN not provided!');

console.log(`Running bot in ${ENVIRONMENT} mode`);

const bot = new Telegraf(BOT_TOKEN);

// --- Commands ---

bot.command('add', async (ctx) => {
  if (!isPrivateChat(ctx.chat?.type)) return;
  await ctx.reply('Please share through this bot: @NeetAspirantsBot', {
    reply_markup: {
      inline_keyboard: [[{ text: 'Open Bot', url: 'https://t.me/NeetAspirantsBot' }]],
    },
  });
});

bot.command('translate', handleTranslateCommand);

bot.command('about', async (ctx) => {
  if (!isPrivateChat(ctx.chat?.type)) return;
  await about()(ctx);
});

bot.command('start', async (ctx) => {
  const chat = ctx.chat;
  const user = ctx.from;
  if (!chat || !user) return;

  if (isPrivateChat(chat.type)) {
    await greeting()(ctx);
  }

  if (chat.id !== ADMIN_ID) {
    const name = user.first_name || chat.title || 'Unknown';
    const username = user.username ? `@${user.username}` : chat.username ? `@${chat.username}` : 'N/A';
    const chatTypeLabel = chat.type.charAt(0).toUpperCase() + chat.type.slice(1);

    await ctx.telegram.sendMessage(
      ADMIN_ID,
      `*New ${chatTypeLabel} started the bot!*\n\n*Name:* ${name}\n*Username:* ${username}\n*Chat ID:* ${chat.id}\n*Type:* ${chat.type}`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Admin: /users
bot.command('users', async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return ctx.reply('You are not authorized.');
  try {
    // Placeholder: Replace with actual logic to fetch user count if needed
    await ctx.reply(`📊 Total interacting entities: [Count unavailable]`, {
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

// --- Main Handler: Study Search ---
bot.on('message', async (ctx) => {
  const chat = ctx.chat;
  const user = ctx.from;
  const message = ctx.message;

  if (!chat?.id || !user) return;

  // Study search (text + mention)
  const isPrivate = isPrivateChat(chat.type);
  const isGroup = chat.type === 'group' || chat.type === 'supergroup';
  const mentionedEntity = message.entities?.find(
    (e) =>
      e.type === 'mention' &&
      message.text?.slice(e.offset, e.offset + e.length).toLowerCase() ===
        `@${BOT_USERNAME.toLowerCase()}`
  );

  if (message.text && (isPrivate || (isGroup && mentionedEntity))) {
    if (mentionedEntity) {
      ctx.message.text = message.text.replace(`@${BOT_USERNAME}`, '').trim();
    }
    await studySearch()(ctx);
  }

  // Notify admin for first interaction
  if (chat.id !== ADMIN_ID) {
    const name = user.first_name || chat.title || 'Unknown';
    const username = user.username ? `@${user.username}` : chat.username ? `@${chat.username}` : 'N/A';
    const chatTypeLabel = chat.type.charAt(0).toUpperCase() + chat.type.slice(1);

    await ctx.telegram.sendMessage(
      ADMIN_ID,
      `*New ${chatTypeLabel} interacted!*\n\n*Name:* ${name}\n*Username:* ${username}\n*Chat ID:* ${chat.id}\n*Type:* ${chat.type}`,
      { parse_mode: 'Markdown' }
    );
  }
});

// --- New Group Members ---
bot.on('new_chat_members', async (ctx) => {
  for (const member of ctx.message.new_chat_members) {
    const name = member.first_name || 'there';
    if (member.username === ctx.botInfo?.username) {
      await ctx.reply(`*Thanks for adding me!*\n\nType *@${BOT_USERNAME} mtg bio* to get study material.`, {
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(`*Hi ${name}!* Welcome! \n\nType *@${BOT_USERNAME} mtg bio* to get study material.`, {
        parse_mode: 'Markdown',
      });
    }
  }
});

// --- Refresh Inline Button ---
bot.action('refresh_users', async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return ctx.answerCbQuery('Unauthorized');
  try {
    // Placeholder: Replace with actual logic to fetch user count if needed
    await ctx.editMessageText(`📊 Total interacting entities: [Count unavailable] (refreshed)`, {
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
