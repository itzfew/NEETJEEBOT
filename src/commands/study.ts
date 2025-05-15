import { Context } from 'telegraf';
import material from '../../data/material.json';

interface MaterialItem {
  title: string;
  link: string;
}

let accessToken: string | null = null;

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

function getInstructionsSection() {
  return [
    { tag: "p", children: ["Instructions and Resources:"] },
    { tag: "p", children: ["Download the study material using the above link."] },
    {
      tag: "p",
      children: [
        "For detailed instructions, watch: ",
        { tag: "a", attrs: { href: "https://youtu.be/example_instructions" }, children: ["YouTube Tutorial"] }
      ]
    },
    { tag: "p", children: ["Join essential channels and bots for more resources:"] },
    {
      tag: "ul",
      children: [
        {
          tag: "li",
          children: [
            { tag: "a", attrs: { href: "https://t.me/Material_eduhubkmrbot" }, children: ["@Material_eduhubkmrbot"] },
            " – for NEET, JEE, and other competitive exams"
          ]
        }
      ]
    },
    { tag: "p", children: ["Features include:"] },
    {
      tag: "ul",
      children: [
        { tag: "li", children: ["Access to study materials for NEET and JEE"] },
        { tag: "li", children: ["Practice tests for NEET and JEE"] },
        { tag: "li", children: ["Links to study groups for peer interaction"] },
        { tag: "li", children: ["NCERT solutions and other helpful resources"] }
      ]
    },
    {
      tag: "p",
      children: [
        "You can also try ",
        { tag: "a", attrs: { href: "https://t.me/EduhubKMR_bot" }, children: ["@EduhubKMR_bot"] },
        " – EduhubKMR QuizBot – Practice NEET Biology, Physics & Chemistry with answers and explanations!"
      ]
    },
    { tag: "p", children: ["More study groups:"] },
    {
      tag: "ul",
      children: [
        { tag: "li", children: [{ tag: "a", attrs: { href: "https://t.me/NEETUG_26" }, children: ["NEETUG_26"] }] },
        { tag: "li", children: [{ tag: "a", attrs: { href: "https://t.me/Neetpw01" }, children: ["Neetpw01"] }] }
      ]
    }
  ];
}

export async function createTelegraphPage(title: string, link: string, matchedItems: MaterialItem[]): Promise<string> {
  if (!accessToken) await createTelegraphAccount();

  const matchedContent = matchedItems.map(item => ({
    tag: 'li',
    children: [
      '➥ ',
      { tag: 'a', attrs: { href: item.link }, children: [item.title] }
    ]
  }));

  const contentArray = [
    { tag: 'h2', children: [title] },
    {
      tag: 'p',
      children: [
        'Download Link: ',
        { tag: 'a', attrs: { href: link }, children: [link] },
      ]
    },
    {
      tag: 'p',
      children: ['🔍 Matched Study Material List:']
    },
    {
      tag: 'ul',
      children: matchedContent
    },
    ...getInstructionsSection()
  ];

  const res = await fetch('https://api.telegra.ph/createPage', {
    method: 'POST',
    body: new URLSearchParams({
      access_token: accessToken!,
      title,
      content: JSON.stringify(contentArray),
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
      try {
        const telegraphLink = await createTelegraphPage(item.title, item.link, [item]);
        response += `• [${item.title}](${telegraphLink})\n`;
      } catch {
        response += `• ${item.title} (Preview unavailable)\n`;
      }
    }

    await ctx.reply(response, { parse_mode: 'Markdown' });
  };
}
