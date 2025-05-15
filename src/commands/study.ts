import { Context } from 'telegraf';
import material from '../../data/material.json';

interface MaterialItem {
  title: string;
  tags: string[];
}

let accessToken: string | null = null;

// Simple similarity function (you can improve if needed)
function similarity(a: string, b: string): number {
  const common = a.split('').filter(char => b.includes(char)).length;
  return common / Math.max(a.length, b.length);
}

function matchMaterial(query: string): MaterialItem[] {
  const keywords = query.toLowerCase().split(/\s+/);
  const results: MaterialItem[] = [];

  for (const item of material as MaterialItem[]) {
    const allText = (item.title + ' ' + item.tags.join(' ')).toLowerCase();
    for (const key of keywords) {
      if (
        allText.includes(key) ||
        item.tags.some(tag => tag.includes(key)) ||
        similarity(allText, key) > 0.4
      ) {
        results.push(item);
        break;
      }
    }
  }

  return results;
}

// Create Telegraph account if not created
async function createTelegraphAccount(): Promise<void> {
  const res = await fetch('https://api.telegra.ph/createAccount', {
    method: 'POST',
    body: new URLSearchParams({
      short_name: 'studybot',
      author_name: 'Study Bot'
    })
  });

  const data = await res.json();
  if (data.ok) {
    accessToken = data.result.access_token;
  } else {
    throw new Error('Failed to create Telegraph account');
  }
}

// Create Telegraph page dynamically with content preview
export async function createTelegraphPage(title: string, content: string): Promise<string> {
  if (!accessToken) await createTelegraphAccount();

  const res = await fetch('https://api.telegra.ph/createPage', {
    method: 'POST',
    body: new URLSearchParams({
      access_token: accessToken!,
      title,
      content: JSON.stringify([{ tag: 'p', children: [content] }]),
      return_content: 'true'
    })
  });

  const data = await res.json();
  if (data.ok) {
    return `https://telegra.ph/${data.result.path}`;
  } else {
    throw new Error('Failed to create Telegraph page');
  }
}

export function studySearch() {
  return async (ctx: Context) => {
    if (!ctx.message || typeof ctx.message.text !== 'string') {
      return ctx.reply('❌ Please send a text message to search study material.');
    }

    const text = ctx.message.text;
    const matches = matchMaterial(text);
    if (matches.length === 0) {
      return ctx.reply('❌ No matching study material found.');
    }

    let response = `🔍 *Matched Study Material:*\n\n`;
    for (const item of matches) {
      const previewText = `Title: ${item.title}\nTags: ${item.tags.join(', ')}`;
      try {
        const telegraphLink = await createTelegraphPage(item.title, previewText);
        response += `• [${item.title}](${telegraphLink})\n`;
      } catch {
        response += `• ${item.title} (Preview unavailable)\n`;
      }
    }

    await ctx.reply(response, { parse_mode: 'Markdown' });
  };
}
