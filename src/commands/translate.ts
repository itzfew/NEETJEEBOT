// src/commands/translate.ts
import { Context } from 'telegraf';
import fetch from 'node-fetch'; // ensure this is installed: npm i node-fetch

export async function translateCommand(ctx: Context) {
  const messageText = ctx.message?.text?.split(' ').slice(1).join(' ')?.trim();
  const repliedText = ctx.message?.reply_to_message?.text;
  const input = messageText || repliedText;

  if (!input) {
    return ctx.reply('Please provide text to translate or reply to a message.\n\nExample:\n/translate bonjour\nor\nReply to a message with /translate');
  }

  try {
    const res = await fetch("https://libretranslate.com/translate", {
      method: "POST",
      body: JSON.stringify({
        q: input,
        source: "auto",
        target: "en",
        format: "text",
        alternatives: 3,
        api_key: ""
      }),
      headers: { "Content-Type": "application/json" }
    });

    const data = await res.json();

    if (!data || !data.translatedText) {
      console.error("Unexpected response from LibreTranslate:", data);
      return ctx.reply('Sorry, translation failed due to an unexpected response.');
    }

    const alternatives = Array.isArray(data.alternatives)
      ? `\n\n*Alternatives:*\n- ${data.alternatives.join('\n- ')}`
      : '';

    const detectedLang = data.detectedLanguage?.language || 'unknown';

    return ctx.replyWithMarkdown(
      `*Detected Language:* ${detectedLang.toUpperCase()}\n\n*Translation:*\n${data.translatedText}${alternatives}`
    );
  } catch (err) {
    console.error('Translation Error:', err);
    return ctx.reply('Sorry, translation failed. Please try again later.');
  }
}
