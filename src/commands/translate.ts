import { Context } from 'telegraf';
import axios from 'axios';

export const translateCommand = async (ctx: Context) => {
  const text = ctx.message?.text?.split(' ').slice(1).join(' ');

  if (!text) {
    return ctx.reply('Usage:\n/translate <text to translate>');
  }

  try {
    const response = await axios.post(
      'https://libretranslate.de/translate',
      {
        q: text,
        source: 'auto',
        target: 'en', // change to 'hi' for Hindi or other ISO 639-1 codes
        format: 'text',
      },
      {
        headers: { accept: 'application/json' },
      }
    );

    const translated = response.data.translatedText;
    await ctx.reply(`Translated:\n\n${translated}`);
  } catch (error) {
    console.error('Translation error:', error);
    await ctx.reply('❌ Failed to translate. Please try again later.');
  }
};
