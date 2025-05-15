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
<div style="border:1px solid #ccc; padding:10px; border-radius:5px; margin-top:10px;">
  <p>Download the study material using the above link.</p>
  <p>For detailed instructions, watch: <a href="https://youtu.be/example_instructions" target="_blank" rel="noopener">YouTube Tutorial</a></p>
  <p><b>Join essential channels and bots for more resources:</b></p>
  <ul>
    <li><a href="https://t.me/Material_eduhubkmrbot" target="_blank" rel="noopener">@Material_eduhubkmrbot</a> for NEET, JEE, and other competitive exams.</li>
  </ul>
  <p><b>Features include:</b></p>
  <ul>
    <li>Access to study materials for <b>NEET</b> and <b>JEE</b></li>
    <li>Practice tests for <b>NEET</b> and <b>JEE</b></li>
    <li>Links to study groups for peer interaction</li>
    <li>NCERT solutions and other helpful resources</li>
  </ul>
  <p>You can also try <a href="https://t.me/EduhubKMR_bot" target="_blank" rel="noopener">@EduhubKMR_bot</a> – EduhubKMR QuizBot – Practice NEET Biology, Physics & Chemistry with answers and explanations!</p>
  <p><b>More study groups:</b></p>
  <ul>
    <li><a href="https://t.me/NEETUG_26" target="_blank" rel="noopener">NEETUG_26</a></li>
    <li><a href="https://t.me/Neetpw01" target="_blank" rel="noopener">Neetpw01</a></li>
  </ul>
</div>
`;

// And update createTelegraphPage content to wrap matched results in a bordered div with arrows:

export async function createTelegraphPage(title: string, link: string): Promise<string> {
  if (!accessToken) await createTelegraphAccount();

  const contentArray = [
    { tag: 'h2', children: [title] },
    {
      tag: 'p',
      children: [
        'Download Link: ',
        { tag: 'a', attrs: { href: link, target: '_blank', rel: 'noopener' }, children: [link] },
      ],
    },
    { tag: 'div', attrs: { style: 'border:1px solid #ccc; padding:10px; border-radius:5px; margin-top:10px;' }, children: [
      { tag: 'p', children: ['🔍 Matched Study Material List:'] },
      { tag: 'ul', children: material.map(item => ({
          tag: 'li',
          children: [
            '➥ ',
            { tag: 'a', attrs: { href: item.link, target: '_blank', rel: 'noopener' }, children: [item.title] }
          ]
      })) },
    ]},
    { tag: 'div', attrs: { style: 'margin-top:15px;' }, children: [
      { tag: 'p', children: ['Instructions and Resources:'] },
      { tag: 'raw', children: [defaultInstructions] } // raw to insert HTML string directly if supported; else parse tags
    ]}
  ];

  // Note: If Telegraph API does not support 'raw', you have to convert defaultInstructions string to tag objects.
  // Or you can send defaultInstructions as plain paragraph array with links.

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
