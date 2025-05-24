// src/commands/translate.ts

import { Telegraf, Context } from 'telegraf';
import axios from 'axios';

const API_BASE = 'https://ftapi.pythonanywhere.com';

export async function handleTranslateCommand(ctx: Context) {
  const input = ctx.message?.text?.split(' ').slice(1).join(' ');
  if (!input) {
    return ctx.reply('Usage:\n/translate <text>\n/translate <source>:<target> <text>');
  }

  // Check if user used sl:dl format
  let sl = '', dl = '', text = input;

  const match = input.match(/^([a-z]{2}):([a-z]{2}) (.+)/i);
  if (match) {
    [, sl, dl, text] = match;
  } else {
    dl = 'en'; // Default destination if not specified
  }

  try {
    const url = sl
      ? `${API_BASE}/translate?sl=${encodeURIComponent(sl)}&dl=${encodeURIComponent(dl)}&text=${encodeURIComponent(text)}`
      : `${API_BASE}/translate?dl=${encodeURIComponent(dl)}&text=${encodeURIComponent(text)}`;

    const res = await axios.get(url);
    const data = res.data;

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

    await ctx.replyWithMarkdown(replyText, {
      disable_web_page_preview: true,
    });
  } catch (err) {
    console.error('Translate error:', err);
    ctx.reply('Failed to translate. Please check the language codes or try again later.');
  }
}
