import { Context } from 'telegraf';
import axios from 'axios';

const API_BASE = 'https://ftapi.pythonanywhere.com';

export const handleTranslateCommand = async (ctx: Context) => {
  try {
    // Check if user replied to a text message
    const repliedText = ctx.message?.reply_to_message?.text;
    if (!repliedText) {
      return ctx.reply('Please reply to a message containing the text you want to translate.');
    }

    // Default destination language is English
    const dl = 'en';

    // Call translate API (auto-detect source language)
    const url = `${API_BASE}/translate?dl=${encodeURIComponent(dl)}&text=${encodeURIComponent(repliedText)}`;

    const { data } = await axios.get(url);

    const replyText = `
*Original (${data['source-language']}):* \`${data['source-text'].trim()}\`
*Translation (${data['destination-language']}):* \`${data['destination-text']}\`
${data.pronunciation?.['destination-text-audio'] ? `[Audio](${data.pronunciation['destination-text-audio']})` : ''}
${
  data.translations?.['possible-translations']
    ? '\n*Possible translations:* ' + data.translations['possible-translations'].join(', ')
    : ''
}
`.trim();

    await ctx.replyWithMarkdown(replyText, { disable_web_page_preview: true });

  } catch (err) {
    console.error('Translate error:', err);
    ctx.reply('Translation failed. Please try again later.');
  }
};
