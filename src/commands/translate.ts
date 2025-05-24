// src/commands/translate.ts

import { Context } from 'telegraf';
import axios from 'axios';

const API_BASE = 'https://ftapi.pythonanywhere.com';

export const handleTranslateCommand = async (ctx: Context) => {
  try {
    const messageText = ctx.message?.text;
    const repliedText = ctx.message?.reply_to_message?.text;

    let input = messageText?.split(' ').slice(1).join(' ').trim();

    // If user replies to a message without providing text, use the replied message
    if (!input && repliedText) {
      input = repliedText;
    }

    if (!input) {
      return ctx.reply('Usage:\n/translate <text>\n/translate <source>:<target> <text>\nYou can also reply to a message.');
    }

    // Extract source and destination languages
    let sl = '', dl = '', text = input;
    const match = input.match(/^([a-z]{2}):([a-z]{2}) (.+)/i);
    if (match) {
      [, sl, dl, text] = match;
    } else {
      dl = 'en'; // Default destination
    }

    const url = sl
      ? `${API_BASE}/translate?sl=${encodeURIComponent(sl)}&dl=${encodeURIComponent(dl)}&text=${encodeURIComponent(text)}`
      : `${API_BASE}/translate?dl=${encodeURIComponent(dl)}&text=${encodeURIComponent(text)}`;

    const { data } = await axios.get(url);

    const replyText = `
*From* (${data['source-language']}): \`${data['source-text'].trim()}\`
*To* (${data['destination-language']}): \`${data['destination-text']}\`
${data.pronunciation?.['destination-text-audio'] ? `[Audio](${data.pronunciation['destination-text-audio']})` : ''}
${
  data.translations?.['possible-translations']
    ? '\n*Possible Translations:* ' + data.translations['possible-translations'].join(', ')
    : ''
}
${
  data.definitions?.length
    ? '\n*Definitions:*\n' + data.definitions.map(
        d => `_${d['part-of-speech']}_: ${d.definition}\n→ _Example_: ${d.example}`
      ).join('\n\n')
    : ''
}`.trim();

    await ctx.replyWithMarkdown(replyText, { disable_web_page_preview: true });

  } catch (err) {
    console.error('Translate error:', err);
    ctx.reply('Translation failed. Please try again or check language codes.');
  }
};
