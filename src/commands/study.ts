import { Context } from 'telegraf';
import material from '../../data/material.json'; // Adjust path as needed

interface MaterialItem {
  title: string;
  tags: string[];
  telegraph: string;
}

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

export function studySearch() {
  return async (ctx: Context) => {
    if (!ctx.message || !('text' in ctx.message)) {
      return ctx.reply('❌ Please send a text message to search study material.');
    }

    const text = ctx.message.text;

    const matches = matchMaterial(text);
    if (matches.length === 0) {
      return ctx.reply('❌ No matching study material found.');
    }

    let response = `🔍 *Matched Study Material:*\n\n`;
    for (const item of matches) {
      response += `• [${item.title}](${item.telegraph})\n`;
    }

    await ctx.reply(response, { parse_mode: 'Markdown' });
  };
}
  
