import { Telegraf, Context } from 'telegraf';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchChatIdsFromFirebase, getLogsByDate } from './utils/chatStore';
import { saveToFirebase } from './utils/saveToFirebase';
import { logMessage } from './utils/logMessage';
import { handleTranslateCommand } from './commands/translate';
import { handleOCRCommand, setBotInstance } from './commands/ocr';
import { about } from './commands/about';
import { greeting } from './text/greeting';
import { setupBroadcast } from './commands/broadcast';
import { studySearch } from './commands/study';

// Load environment variables
import { config } from 'dotenv';
config();

// Helper to check private chat type
const isPrivateChat = (type?: string) => type === 'private';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const ADMIN_ID = 6930703214;
const BOT_USERNAME = 'SearchNEETJEEBot';

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN not provided!');
  throw new Error('BOT_TOKEN not provided!');
}

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
bot.command('ocr', handleOCRCommand);

bot.command('about', async (ctx) => {
  if (!isPrivateChat(ctx.chat?.type)) return;
  await about()(ctx);
});

bot.command('start', async (ctx) => {
  const chat = ctx.chat;
  const user = ctx.from;
  if (!chat || !user) return;

  const alreadyNotified = await saveToFirebase(chat);

  if (isPrivateChat(chat.type)) {
    await greeting()(ctx);
    await logMessage(chat.id, '/start', user);
  }

  if (!alreadyNotified && chat.id !== ADMIN_ID) {
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
    const chatIds = await fetchChatIdsFromFirebase();
    await ctx.reply(`📊 Total interacting entities: ${chatIds.length}`, {
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

// Admin: /logs
bot.command('logs', async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return;
  const parts = ctx.message?.text?.split(' ') || [];
  if (parts.length < 2)
    return ctx.reply("Usage: /logs <YYYY-MM-DD> or /logs <chatid>");

  const dateOrChatId = parts[1];
  try {
    const logs = await getLogsByDate(dateOrChatId);
    if (logs === 'No logs found for this date.') {
      await ctx.reply(logs);
    } else {
      await ctx.replyWithDocument({
        source: Buffer.from(logs, 'utf-8'),
        filename: `logs-${dateOrChatId}.txt`,
      });
    }
  } catch (err) {
    console.error('Error fetching logs:', err);
    await ctx.reply('❌ Error fetching logs.');
  }
});

// Admin: /broadcast
setupBroadcast(bot);
setBotInstance(bot);

// --- Main Handler: Log + Search ---

bot.on('message', async (ctx) => {
  const chat = ctx.chat;
  const user = ctx.from;
  const message = ctx.message;

  if (!chat?.id || !user) return;

  const alreadyNotified = await saveToFirebase(chat);

  // Logging
  if (isPrivateChat(chat.type)) {
    let logText = '[Unknown/Unsupported message type]';

    if ('text' in message) {
      logText = message.text;
    } else if ('photo' in message) {
      logText = '[Photo message]';
    } else if ('document' in message) {
      logText = `[Document: ${message.document.file_name || 'Unnamed'}]`;
    } else if ('video' in message) {
      logText = '[Video message]';
    } else if ('voice' in message) {
      logText = '[Voice message]';
    } else if ('audio' in message) {
      logText = '[Audio message]';
    } else if ('sticker' in message) {
      logText = `[Sticker: ${message.sticker.emoji || 'Sticker'}]`;
    } else if ('contact' in message) {
      logText = '[Contact shared]';
    } else if ('location' in message) {
      const loc = message.location;
      logText = `[Location: ${loc.latitude}, ${loc.longitude}]`;
    } else if ('poll' in message) {
      logText = `[Poll: ${message.poll.question}]`;
    }

    try {
      await logMessage(chat.id, logText, user);
    } catch (err) {
      console.error('Failed to log message:', err);
    }

    // Forward non-text messages to admin
    if (!('text' in message)) {
      const name = user.first_name || 'Unknown';
      const username = user.username ? `@${user.username}` : 'N/A';
      const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      const header = `*Non-text message received!*\n\n*Name:* ${name}\n*Username:* ${username}\n*Chat ID:* ${chat.id}\n*Time:* ${time}\n`;

      try {
        await ctx.telegram.sendMessage(ADMIN_ID, header, { parse_mode: 'Markdown' });
        await ctx.forwardMessage(ADMIN_ID, chat.id, message.message_id);
      } catch (err) {
        console.error('Failed to forward non-text message:', err);
      }
    }
  }

  // Study search (text + mention)
  const isPrivate = isPrivateChat(chat.type);
  const isGroup = chat.type === 'group' || chat.type === 'supergroup';
  const mentionedEntity = 'entities' in message && message.entities?.find(
    (e) =>
      e.type === 'mention' &&
      message.text?.slice(e.offset, e.offset + e.length).toLowerCase() ===
        `@${BOT_USERNAME.toLowerCase()}`
  );

  if ('text' in message && (isPrivate || (isGroup && mentionedEntity))) {
    if (mentionedEntity) {
      ctx.message.text = message.text.replace(`@${BOT_USERNAME}`, '').trim();
    }
    await studySearch()(ctx);
  }

  // Notify admin for first interaction
  if (!alreadyNotified && chat.id !== ADMIN_ID) {
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
    const chatIds = await fetchChatIdsFromFirebase();
    await ctx.editMessageText(`📊 Total interacting entities: ${chatIds.length} (refreshed)`, {
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
export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    // Validate request method
    if (req.method !== 'POST') {
      console.warn(`Invalid request method: ${req.method}`);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Validate request body
    if (!req.body) {
      console.error('Request body is empty');
      return res.status(400).json({ error: 'Empty request body' });
    }

    // Validate update_id
    if (!('update_id' in req.body)) {
      console.error('Invalid Telegram update: missing update_id', JSON.stringify(req.body));
      return res.status(400).json({ error: 'Invalid Telegram update: missing update_id' });
    }

    // Process the Telegram update
    await bot.handleUpdate(req.body);
    return res.status(200).json({ status: 'OK' });
  } catch (err) {
    console.error('Vercel handler error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// --- Bot Launch ---
if (ENVIRONMENT !== 'production') {
  // Use polling for development
  bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log('EduHub Bot is running locally with polling...');
  });

  // Handle graceful shutdown
  process.once('SIGINT', () => {
    console.log('Received SIGINT. Stopping bot...');
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    console.log('Received SIGTERM. Stopping bot...');
    bot.stop('SIGTERM');
  });
} else {
  // In production, rely on Vercel webhooks (no bot.launch)
  console.log('Bot configured for webhooks in production mode');
}
