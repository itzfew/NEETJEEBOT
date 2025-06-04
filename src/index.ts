import { Telegraf, Context } from 'telegraf';
import { VercelRequest, VercelResponse } from '@vercel/node';
import Tesseract from 'tesseract.js';
import { fetchChatIdsFromFirebase, getLogsByDate } from './utils/chatStore';
import { saveToFirebase } from './utils/saveToFirebase';
import { logMessage } from './utils/logMessage';
import { handleTranslateCommand } from './commands/translate';
import { about } from './commands/about';
import { greeting } from './text/greeting';
import { production, development } from './core';
import { setupBroadcast } from './commands/broadcast';
import { studySearch } from './commands/study';

// Helper to check private chat type
const isPrivateChat = (type?: string) => type === 'private';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ENVIRONMENT = process.env.NODE_ENV || '';
const ADMIN_ID = 6930703214;
const BOT_USERNAME = 'SearchNEETJEEBot';

// In-memory cache to track processed image file IDs
const processedImages = new Set<string>();

if (!BOT_TOKEN) throw new Error('BOT_TOKEN not provided!');

console.log(`Running bot in ${ENVIRONMENT} mode`);

const bot = new Telegraf(BOT_TOKEN);

// --- OCR Command ---
bot.command('ocr', async (ctx) => {
  const chat = ctx.chat;
  const user = ctx.from;
  const message = ctx.message;

  if (!chat || !user) return;

  // Check if the message is a reply to an image or contains an image
  const repliedMessage = ctx.message.reply_to_message;
  let photo;

  if (repliedMessage && 'photo' in repliedMessage) {
    photo = repliedMessage.photo;
  } else if ('photo' in message) {
    photo = message.photo;
  }

  if (!photo) {
    return ctx.reply('Please send an image or reply to an image with /ocr.');
  }

  try {
    // Get the highest resolution photo
    const fileId = photo[photo.length - 1].file_id;

    // Check if the image has already been processed
    if (processedImages.has(fileId)) {
      return ctx.reply('This image has already been processed. Please send a new image.', {
        reply_to_message_id: message.message_id,
      });
    }

    // Send a loading message
    const loadingMessage = await ctx.reply('Processing image, please wait...', {
      reply_to_message_id: message.message_id,
    });

    // Get file details
    const file = await ctx.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    // Validate file format
    const fileExtension = file.file_path?.split('.').pop()?.toLowerCase();
    const supportedFormats = ['jpg', 'jpeg', 'png', 'bmp', 'tiff'];
    if (!fileExtension || !supportedFormats.includes(fileExtension)) {
      await ctx.telegram.deleteMessage(chat.id, loadingMessage.message_id);
      return ctx.reply(
        `❌ Unsupported file format. Please use an image in one of these formats: ${supportedFormats.join(', ')}.`,
        { reply_to_message_id: message.message_id }
      );
    }

    // Perform OCR with Tesseract.js
    const { data: { text } } = await Tesseract.recognize(fileUrl, 'eng', {
      corePath: 'https://unpkg.com/tesseract.js-core@v5.1.0/tesseract-core-simd.wasm',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    });

    // Clean up the extracted text
    const cleanedText = text.trim() || 'No text could be extracted from the image.';

    // Delete the loading message
    await ctx.telegram.deleteMessage(chat.id, loadingMessage.message_id);

    // Reply with the extracted text
    await ctx.reply(`📄 Extracted Text:\n\n${cleanedText}`, {
      reply_to_message_id: message.message_id,
    });

    // Mark the image as processed
    processedImages.add(fileId);

    // Log the OCR command
    await logMessage(chat.id, `/ocr: ${cleanedText.slice(0, 100)}...`, user);

    // Notify admin about OCR usage
    if (chat.id !== ADMIN_ID) {
      const name = user.first_name || chat.title || 'Unknown';
      const username = user.username ? `@${user.username}` : chat.username ? `@${chat.username}` : 'N/A';
      const time = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      await ctx.telegram.sendMessage(
        ADMIN_ID,
        `*OCR Command Used!*\n\n*Name:* ${name}\n*Username:* ${username}\n*Chat ID:* ${chat.id}\n*Time:* ${time}\n*Extracted Text (preview):* ${cleanedText.slice(0, 100)}...`,
        { parse_mode: 'Markdown' }
      );
      // Forward the image to admin
      await ctx.forwardMessage(ADMIN_ID, chat.id, message.message_id);
    }
  } catch (err) {
    console.error('OCR Error:', err);
    await ctx.reply(
      `❌ Error processing image: ${err.message || 'Unknown error'}. Please ensure the image contains clear text or is in a supported format (JPG, JPEG, PNG, BMP, TIFF).`,
      { reply_to_message_id: message.message_id }
    );
  }
});

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
    return ctx.reply('Usage: /logs <YYYY-MM-DD> or /logs <chatid>');

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

// --- Main Handler: Log + Search ---

bot.on('message', async (ctx) => {
  const chat = ctx.chat;
  const user = ctx.from;
  const message = ctx.message;

  if (!chat?.id || !user) return;

  const alreadyNotified = await saveToFirebase([]);

  // Logging
  if (isPrivateChat(chat.type)) {
    let logText = '[Unknown/Unsupported message type]';

    if (message.text) {
      logText = message.text;
    } else if (message.photo) {
      logText = '[Photo message]';
    } else if (message.document) {
      logText = `[Document: ${message.document.file_name || 'Unnamed'}]`;
    } else if (message.video) {
      logText = '[Video message]';
    } else if (message.voice) {
      logText = '[Voice message]';
    } else if (message.audio) {
      logText = '[Audio message]';
    } else if (message.sticker) {
      logText = `[Sticker: ${message.sticker.emoji || 'Sticker'}]`;
    } else if (message.contact) {
      logText = '[Contact shared]';
    } else if (message.location) {
      const loc = message.location;
      logText = `[Location: ${loc.latitude}, ${loc.longitude}]`;
    } else if (message.poll) {
      logText = `[Poll: ${message.poll.question}]`;
    }

    try {
      await logMessage(chat.id, logText, user);
    } catch (err) {
      console.error('Failed to log message:', err);
    }

    // Forward non-text messages to admin
    if (!message.text) {
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
  const mentionedEntity = message.entities?.find(
    (e) =>
      e.type === 'mention' &&
      message.text?.slice(e.offset, e.offset + e.length).toLowerCase() ===
      `@${BOT_USERNAME}`
  );

  if (message.text && (isPrivate || (isGroup && mentionedEntity))) {
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
    const name = member.first_name || 'Unknown';
    if (member.username === ctx.botInfo?.username) {
      await ctx.reply(`*Thanks for adding me!*\n\nType *@${BOT_USERNAME} mtgrok* to get study material or /ocr to extract images.`, {
        parse_mode: 'Markdown',
      });
    } else {
      await ctx.reply(`*Hi ${name}!* Welcome! \n\nType *@${BOT_USERNAME} mtgrok* to get study material or /ocr to extract images.`, {
        parse_mode: 'Markdown',
      });
    }
  }
});

// --- Refresh button ---
bot.action('refresh_users', async (ctx) => {
  if (ctx.from?.id !== ADMIN_ID) return ctx.actionCbQuery('Unauthorized');
  try {
    const chatIds = await fetchChatIdsFromFirebase();
    await ctx.editMessageText(`📊 Total interacting entities: ${chatIds.length} (refreshed)`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: 'Refresh', callback_data: 'refresh_users' }]],
      },
    });
    await ctx.actionCbQuery('Refreshed!');
  } catch (err) {
    console.error('Failed to refresh user count:', err);
    await ctx.actionCbQuery('Refresh failed');
  }
});

// --- Vercel Export ---
export const startVercel = async (req: VercelRequest, res: VercelResponse) => {
  await production(req, res, bot);
};

if (ENVIRONMENT !== 'production') {
  development(bot);
