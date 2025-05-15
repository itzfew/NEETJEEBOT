import { Context } from 'telegraf';
import material from '../../data/material.json';
import { Telegraph } from 'telegraph-node';

const telegraph = new Telegraph();
let accessToken: string | null = null;

interface MaterialItem {
  title: string;
  tags: string[];
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

async function createTelegraphPage(title: string, content: string): Promise<string> {
  if (!accessToken) {
    const account = await telegraph.createAccount("StudyBot", {
      short_name: "studybot",
      author_name: "Study Bot",
    });
    accessToken = account.access_token;
  }

  const page = await telegraph.createPage(accessToken, title, [
    {
      tag: 'p',
      children: [content],
    }
  ], { return_content: true });

  return `https://telegra.ph/${page.path}`;
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
      const previewText = `Title: ${item.title}\nTags: ${item.tags.join(', ')}`;
      const telegraphLink = await createTelegraphPage(item.title, previewText);
      response += `• [${item.title}](${telegraphLink})\n`;
    }

    await ctx.reply(response, { parse_mode: 'Markdown' });
  };
}
