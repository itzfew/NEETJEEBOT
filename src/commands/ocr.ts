import { Context } from 'telegraf';
import { createWorker } from 'tesseract.js';
import axios from 'axios';

// Function to download the image from Telegram
async function downloadTelegramImage(fileId: string, botToken: string): Promise<Buffer> {
  try {
    const file = await (new (require('telegraf').Telegraf)(botToken)).telegram.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (err) {
    throw new Error(`Failed to download image: ${err.message}`);
  }
}

// Function to perform OCR using Tesseract.js
async function performOCR(imageBuffer: Buffer, lang: string = 'eng'): Promise<string> {
  const worker = await createWorker({
    logger: (m) => console.log('Tesseract progress:', m),
    // Ensure WASM files are loaded from the correct path
    corePath: '/node_modules/tesseract.js-core/',
  });

  try {
    await worker.load();
    await worker.loadLanguage(lang);
    await worker.initialize(lang);
    const { data: { text } } = await worker.recognize(imageBuffer);
    await worker.terminate();
    return text.trim();
  } catch (err) {
    throw new Error(`OCR processing failed: ${err.message}`);
  }
}

// Handler for the /ocr command
export const handleOCRCommand = async (ctx: Context) => {
  try {
    const repliedMessage = ctx.message?.reply_to_message;
    if (!repliedMessage || !('photo' in repliedMessage)) {
      return ctx.reply('Please reply to an image with /ocr to extract text.');
    }

    const photo = repliedMessage.photo[repliedMessage.photo.length - 1];
    if (!photo) {
      return ctx.reply('No valid image found in the replied message.');
    }

    const imageBuffer = await downloadTelegramImage(photo.file_id, process.env.BOT_TOKEN!);
    const extractedText = await performOCR(imageBuffer);

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
