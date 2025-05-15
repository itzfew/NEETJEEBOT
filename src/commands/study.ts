import { Context } from 'telegraf';
import material from '../../data/material.json';

interface MaterialItem {
  title: string;
  link: string;
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
    const allText = item.title.toLowerCase();
    for (const key of keywords) {
      if (
        allText.includes(key) ||
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
      author_name: 'Study Bot',
    }),
  });

  const data = await res.json();
  if (data.ok) {
    accessToken = data.result.access_token;
  } else {
    throw new Error('Failed to create Telegraph account');
  }
}

// Default instructions + resource links to add to each page
const defaultInstructions = `
Download the study material using the above link.

For detailed instructions, watch: https://youtu.be/example_instructions

Join essential channels and bots for more resources:
- **@Material_eduhubkmrbot** for NEET, JEE, and other competitive exams.
- Features include:
  - Access to study materials for **NEET** and **JEE**
  - Practice tests for **NEET** and **JEE**
  - Links to study groups for peer interaction
  - NCERT solutions and other helpful resources

You can also try [@EduhubKMR_bot](https://t.me/EduhubKMR_bot) – EduhubKMR QuizBot – Practice **NEET Biology**, **Physics** & **Chemistry** with answers and explanations!

More study groups:
- https://t.me/NEETUG_26
- https://t.me/Neetpw01
`;

// Create Telegraph page dynamically with content preview
export async function createTelegraphPage(title: string, link: string): Promise<string> {
  if (!accessToken) await createTelegraphAccount();

  // Build the content array according to Telegraph API format
  const contentArray = [
    { tag: 'h2', children: [title] },
    {
      tag: 'p',
      children: [
        'Download Link: ',
        { tag: 'a', attrs: { href: link }, children: [link] }
      ],
    },
    { tag: 'p', children: [defaultInstructions] },
  ];

  const res = await fetch('https://api.telegra.ph/createPage', {
    method: 'POST',
    body: new URLSearchParams({
      access_token: accessToken!,
      title,
      content: JSON.stringify(contentArray),
      return_content: 'true',
    }),
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
      try {
        const telegraphLink = await createTelegraphPage(item.title, item.link);
        response += `• [${item.title}](${telegraphLink})\n`;
      } catch {
        response += `• ${item.title} (Preview unavailable)\n`;
      }
    }

    await ctx.reply(response, { parse_mode: 'Markdown' });
  };
}
