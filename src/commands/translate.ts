// src/commands/translate.ts
import { Context } from 'telegraf';
import axios from 'axios';

export async function translateCommand(ctx: Context) {
  const input = ctx.message?.text?.split(' ').slice(1).join(' ');
  if (!input) {
    return ctx.reply('Please provide text to translate.\nExample: /translate bonjour');
  }

  try {
    const response = await axios.post('https://libretranslate.com/translate', {
      q: input,
      source: 'auto',
      target: 'en',
      format: 'text',
    });

    const translated = response.data.translatedText;
    ctx.reply(`**Translated:**\n${translated}`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Translation error:', error);
    ctx.reply('Sorry, translation failed.');
  }
}
