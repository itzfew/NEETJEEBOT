import { Context } from 'telegraf';
import material from '../../data/material.json';
import { fetch } from 'undici';

interface MaterialItem {
  title: string;
  label: string;
  key: string;
  telegramLink: string;
  shortenedLink: string | null;
}

const linkCache = new Map<string, string>();
let accessToken: string | null = null;
const ADRINO_API_KEY = '5a2539904639474b5f3da41f528199204eb76f65';

function createTelegramLink(key: string): string {
  return `https://t.me/Material_eduhubkmrbot?start=${key}`;
}

async function shortenLink(link: string, alias: string): Promise<string> {
  if (linkCache.has(alias)) return linkCache.get(alias)!;

  try {
    if (alias.length > 30) alias = alias.substring(0, 30);
    const url = `https://adrinolinks.in/api?api=${ADRINO_API_KEY}&url=${encodeURIComponent(link)}&alias=${alias}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'success') {
      linkCache.set(alias, data.shortenedUrl);
      return data.shortenedUrl;
    }
    return link;
  } catch (e) {
    console.error('Shorten failed:', e);
    return link;
  }
}

function calculateSimilarity(a: string, b: string): number {
  const normalize = (text: string) => new Set(text.toLowerCase().split(/\s+/));
  const setA = normalize(a), setB = normalize(b);
  const intersection = [...setA].filter(x => setB.has(x));
  return intersection.length / Math.max(setA.size, setB.size);
}

let materialData: MaterialItem[] = [];

async function initializeMaterialData(): Promise<void> {
  const output: MaterialItem[] = [];
  for (const cat of material) {
    for (const item of cat.items) {
      const tgLink = createTelegramLink(item.key);
      output.push({
        title: cat.title,
        label: item.label,
        key: item.key,
        telegramLink: tgLink,
        shortenedLink: null,
      });
    }
  }
  materialData = output;
}

async function getShortenedLink(item: MaterialItem): Promise<string> {
  if (item.shortenedLink) return item.shortenedLink;
  const shortLink = await shortenLink(item.telegramLink, item.key);
  item.shortenedLink = shortLink;
  return shortLink;
}

interface ScoredItem {
  item: MaterialItem;
  score: number;
}

function layeredMatchMaterial(query: string): Record<string, ScoredItem[]> {
  const results: Record<string, ScoredItem[]> = {
    '100% Match': [],
    '90%+ Match': [],
    '80%+ Match': [],
    '70%+ Match': [],
  };

  for (const item of materialData) {
    const text = `${item.title} ${item.label}`.toLowerCase();
    const score = calculateSimilarity(text, query.toLowerCase());

    const scored = { item, score };

    if (score === 1) results['100% Match'].push(scored);
    else if (score >= 0.9) results['90%+ Match'].push(scored);
    else if (score >= 0.8) results['80%+ Match'].push(scored);
    else if (score >= 0.7) results['70%+ Match'].push(scored);
  }

  return results;
}

const defaultInstructions = [
  {
    tag: 'p',
    children: [
      '📺 How to open link: ',
      {
        tag: 'a',
        attrs: { href: 'https://youtu.be/S912R5lMShI?si=l5RsBbkbXaxFowbZ' },
        children: ['YouTube Guide'],
      },
    ],
  },
  {
    tag: 'ul',
    children: [
      {
        tag: 'li',
        children: [
          { tag: 'a', attrs: { href: 'https://t.me/Material_eduhubkmrbot' }, children: ['@Material_eduhubkmrbot'] },
          ' - Study materials',
        ],
      },
      {
        tag: 'li',
        children: [
          { tag: 'a', attrs: { href: 'https://t.me/EduhubKMR_bot' }, children: ['@EduhubKMR_bot'] },
          ' - QuizBot',
        ],
      },
      {
        tag: 'li',
        children: [
          { tag: 'a', attrs: { href: 'https://t.me/NEETPW01' }, children: ['@NEETPW01'] },
          ' - Group For Discussion',
        ],
      },
      {
        tag: 'li',
        children: [
          { tag: 'a', attrs: { href: 'https://t.me/NEETUG_26' }, children: ['@NEETUG_26'] },
          ' - NEET JEE Channel',
        ],
      },
    ],
  },
];

async function createTelegraphAccount() {
  const res = await fetch('https://api.telegra.ph/createAccount', {
    method: 'POST',
    body: new URLSearchParams({
      short_name: 'studybot',
      author_name: 'Study Bot',
    }),
  });
  const data = await res.json();
  if (data.ok) accessToken = data.result.access_token;
  else throw new Error(data.error || 'Telegraph account creation failed');
}

async function createTelegraphPageForMatches(query: string, grouped: Record<string, ScoredItem[]>): Promise<string> {
  if (!accessToken) await createTelegraphAccount();

  const content = [
    { tag: 'h3', children: [`Results for: "${query}"`] },
  ];

  for (const group of ['100% Match', '90%+ Match', '80%+ Match', '70%+ Match']) {
    const list = grouped[group];
    if (list.length === 0) continue;

    content.push({ tag: 'h4', children: [group] });

    const links = await Promise.all(list.map(({ item }) => getShortenedLink(item)));

    content.push({
      tag: 'ul',
      children: list.map(({ item }, i) => ({
        tag: 'li',
        children: [
          { tag: 'a', attrs: { href: links[i] }, children: [item.label] },
          ` (${item.title})`,
        ],
      })),
    });
  }

  content.push(
    { tag: 'hr' },
    { tag: 'h4', children: ['ℹ️ Resources & Instructions'] },
    ...defaultInstructions,
    {
      tag: 'p',
      attrs: { style: 'color: gray; font-size: 0.8em' },
      children: ['Generated by Study Bot'],
    }
  );

  const res = await fetch('https://api.telegra.ph/createPage', {
    method: 'POST',
    body: new URLSearchParams({
      access_token: accessToken!,
      title: `Study Material: ${query.slice(0, 50)}${query.length > 50 ? '...' : ''}`,
      author_name: 'Study Bot',
      content: JSON.stringify(content),
      return_content: 'true',
    }),
  });

  const data = await res.json();
  if (data.ok) return `https://telegra.ph/${data.result.path}`;
  throw new Error(data.error || 'Page creation failed');
}

initializeMaterialData().catch(console.error);

export function studySearch() {
  return async (ctx: Context) => {
    try {
      if (!ctx.message || !('text' in ctx.message)) return;

      const query = ctx.message.text.trim();
      if (!query) {
        await ctx.reply('❌ Please enter a search term.', {
          reply_to_message_id: ctx.message.message_id
        });
        return;
      }

      const mention = ctx.chat?.type?.includes('group') && ctx.from?.username
        ? `@${ctx.from.username}`
        : ctx.from?.first_name || '';

      const grouped = layeredMatchMaterial(query);
      const totalMatches = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

      if (totalMatches === 0) {
        await ctx.reply(`❌ ${mention}, no materials found for "${query}".`, {
          reply_to_message_id: ctx.message.message_id
        });
        return;
      }

      const url = await createTelegraphPageForMatches(query, grouped);
      await ctx.reply(
        `🔍 ${mention}, found *${totalMatches}* relevant materials:\n[View materials](${url})`,
        {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_to_message_id: ctx.message.message_id
        }
      );
    } catch (error) {
      console.error('Study search error:', error);
      try {
        await ctx.reply('❌ Something went wrong. Please try again later.', {
          reply_to_message_id: ctx.message?.message_id
        });
      } catch (e) {
        console.error('Failed to send error message:', e);
      }
    }
  };
}
