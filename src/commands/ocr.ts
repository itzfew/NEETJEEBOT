import { Context, Telegraf } from 'telegraf';
import { createWorker } from 'tesseract.js';
import axios from 'axios';

// Reuse the bot instance from index.ts
let botInstance: Telegraf | null = null;

export function setBotInstance(bot: Telegraf) {
  botInstance = bot;
}

// Function to download the image from Telegram
async function downloadTelegramImage(fileId: string, botToken: string): Promise<Buffer> {
  if (!botInstance) {
    throw new Error('Bot instance not initialized');
  }
  try {
    const file = await botInstance.telegram.getFile(fileId);
    if (!file.file_path) {
      throw new Error('File path not found for the provided file_id');
    }
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (err) {
    throw new Error(`Failed to download image: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

// Function to perform OCR using Tesseract.js
async function performOCR(imageBuffer: Buffer, lang: string = 'eng'): Promise<string> {
  const worker = await createWorker({
    logger: (m) => console.log('Tesseract progress:', m),
    // Use CDN for WASM files to ensure Vercel compatibility
    corePath: 'https://unpkg.com/tesseract.js-core@5.1.0/',
    workerPath: 'https://unpkg.com/tesseract.js@5.1.0/dist/worker.min.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
  });

  try {
    await worker.load();
    await worker.loadLanguage(lang);
    await worker.initialize(lang);
    const { data: { text } } = await worker.recognize(imageBuffer);
    await worker.terminate();
    return text.trim();
  } catch (err) {
    throw new Error(`OCR processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

// Handler for the /ocr command
export const handleOCRCommand = async (ctx: Context) => {
  // Validate BOT_TOKEN
  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error('BOT_TOKEN not provided');
    return ctx.reply('Internal error: Bot configuration missing.');
  }

  try {
    // Type guard for message and reply_to_message
    if (!('message' in ctx) || !ctx.message || !('reply_to_message' in ctx.message)) {
      return ctx.reply('Please reply to an image with /ocr to extract text.');
    }

    const repliedMessage = ctx.message.reply_to_message;
    if (!('photo' in repliedMessage) || !repliedMessage.photo || repliedMessage.photo.length === 0) {
      return ctx.reply('No valid image found in the replied message.');
    }

    // Extract language from command (e.g., /ocr eng, /ocr hin)
    const commandText = 'text' in ctx.message ? ctx.message.text : '';
    const parts = commandText.split(' ');
    const lang = parts.length > 1 && parts[1] ? parts[1] : 'eng';

    // Send loading message
    const loadingMessage = await ctx.reply('Processing image, please wait...');

    // Get the highest resolution photo
    const photo = repliedMessage.photo[repliedMessage.photo.length - 1];
    const imageBuffer = await downloadTelegramImage(photo.file_id, BOT_TOKEN);
    const extractedText = await performOCR(imageBuffer, lang);

    // Delete loading message
    await ctx.telegram.deleteMessage(ctx.chat!.id, loadingMessage.message_id);

    if (extractedText) {
      // Truncate text to avoid Telegram message limits (4096 characters)
      const maxLength = 4000;
      const truncatedText = extractedText.length > maxLength 
        ? `${extractedText.slice(0, maxLength)}...` 
        : extractedText;
      await ctx.replyWithMarkdownV2(
        `*Extracted Text:*\n\`\`\`\n${truncatedText.replace(/([*_`[])/g, '\\$1')}\n\`\`\``
      );
    } else {
      await ctx.reply('No text could be extracted from the image.');
    }
  } catch (err) {
    console.error('OCR error:', {
      error: err instanceof Error ? err.message : 'Unknown error',
      chatId: ctx.chat?.id,
      userId: ctx.from?.id,
    });
    await ctx.reply('Failed to process image. Please try again or use a clearer image.');
  }
};
