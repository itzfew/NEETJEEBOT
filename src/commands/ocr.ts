import { Context, Telegraf } from 'telegraf';
import { createWorker } from 'tesseract.js';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

// Environment setup (ensure you have a .env file with BOT_TOKEN)
require('dotenv').config();

// Initialize the bot
const bot = new Telegraf(process.env.BOT_TOKEN as string);

// Function to download the image from Telegram
async function downloadTelegramImage(fileId: string): Promise<Buffer> {
  try {
    const file = await bot.telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (err) {
    throw new Error(`Failed to download image: ${err.message}`);
  }
}

// Function to perform OCR using Tesseract.js
async function performOCR(imageBuffer: Buffer, lang: string = 'eng'): Promise<string> {
  const worker = await createWorker({
    logger: (m) => console.log('Tesseract progress:', m), // Log progress
  });

  try {
    // Load and initialize the worker
    await worker.load();
    await worker.loadLanguage(lang);
    await worker.initialize(lang);

    // Perform OCR on the image buffer
    const { data: { text } } = await worker.recognize(imageBuffer);
    
    // Terminate the worker to free resources
    await worker.terminate();
    
    return text.trim();
  } catch (err) {
    throw new Error(`OCR processing failed: ${err.message}`);
  }
}

// Handler for the /ocr command
export const handleOCRCommand = async (ctx: Context) => {
  try {
    // Check if the message is a reply to an image
    const repliedMessage = ctx.message?.reply_to_message;
    if (!repliedMessage || !('photo' in repliedMessage)) {
      return ctx.reply('Please reply to an image with /ocr to extract text.');
    }

    // Get the highest resolution photo from the replied message
    const photo = repliedMessage.photo[repliedMessage.photo.length - 1];
    if (!photo) {
      return ctx.reply('No valid image found in the replied message.');
    }

    // Download the image
    const imageBuffer = await downloadTelegramImage(photo.file_id);

    // Perform OCR
    const extractedText = await performOCR(imageBuffer);

    // Reply with the extracted text
    if (extractedText) {
      await ctx.replyWithMarkdown(`*Extracted Text:*\n\`\`\`\n${extractedText}\n\`\`\``);
    } else {
      await ctx.reply('No text could be extracted from the image.');
    }

  } catch (err) {
    console.error('OCR error:', err);
    await ctx.reply(`Failed to process image: ${err.message}`);
  }
};

// Register the command handler
bot.command('ocr', handleOCRCommand);

// Launch the bot
bot.launch().then(() => {
  console.log('Bot is running...');
});

// Handle graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
