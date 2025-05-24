// src/commands/translate.ts
import { Context } from 'telegraf';
import axios from 'axios';

export async function translateCommand(ctx: Context) {
  // Get input from command or replied message
  const messageText = ctx.message?.text?.split(' ').slice(1).join(' ')?.trim();
  const repliedText = ctx.message?.reply_to_message?.text;
  const input = messageText || repliedText;

  if (!input) {
    return ctx.reply('Please provide text to translate or reply to a message.\n\nExample:\n/translate bonjour\nor\nReply with /translate');
  }

  try {
    const res = await axios.post('https://libretranslate.com/translate', {
      q: input,
      source: 'auto',
      target: 'en',
      format: 'text'
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const translated = res.data.translatedText;
    await ctx.reply(`**Translated to English:**\n${translated}`, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Translation Error:', err?.response?.data || err.message);
    await ctx.reply('Sorry, translation failed. Please try again later.');
  }
}
