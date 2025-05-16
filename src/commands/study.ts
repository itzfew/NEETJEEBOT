import { Context } from 'telegraf';
import material from '../../data/material.json';
import { fetch } from 'undici';

interface MaterialItem {
  title: string;
  label: string;
  key: string;
  telegramLink: string;
  shortenedLink: string | null; // Can be null if not shortened yet
}

// Cache for shortened links to avoid repeated API calls
const linkCache = new Map<string, string>();
let accessToken: string | null = null;
const ADRINO_API_KEY = '5a2539904639474b5f3da41f528199204eb76f65';

// -------------------- Helpers --------------------
function createTelegramLink(key: string): string {
  return `https://t.me/Material_eduhubkmrbot?start=${key}`;
}

async function shortenLink(link: string, alias: string): Promise<string> {
  // Check cache first
  if (linkCache.has(alias)) {
    return linkCache.get(alias)!;
  }

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

function similarity(a: string, b: string): number {
  const sa = new Set(a.toLowerCase());
  const sb = new Set(b.toLowerCase());
  const common = [...sa].filter(ch => sb.has(ch)).length;
  return common / Math.max(sa.size, sb.size);
}

// -------------------- Prepare & Match --------------------
// Pre-cache all material data on startup
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
        shortenedLink: null, // Will be shortened on demand
      });
    }
  }

  materialData = output;
}

async function getShortenedLink(item: MaterialItem): Promise<string> {
  if (item.shortenedLink) return item.shortenedLink;
  
  const shortLink = await shortenLink(item.telegramLink, item.key);
  item.shortenedLink = shortLink; // Update cache
  return shortLink;
}

function matchMaterial(query: string): MaterialItem[] {
  const keywords = query.toLowerCase().split(/\s+/);
  
  return materialData.filter(item => {
    const text = `${item.title} ${item.label}`.toLowerCase();
    return keywords.some(k => text.includes(k) || similarity(text, k) > 0.4);
  });
}

// -------------------- Telegraph Integration --------------------
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
    tag: 'p',
    children: ['📚 Join more recommended bots:']
  },
  {
    tag: 'ul',
    children: [
      {
        tag: 'li',
        children: [
          {
            tag: 'a',
            attrs: { href: 'https://t.me/Material_eduhubkmrbot' },
            children: ['@Material_eduhubkmrbot'],
          },
          ' - Study materials',
        ],
      },
      
      {
        tag: 'li',
        children: [
          {
            tag: 'a',
            attrs: { href: 'https://t.me/EduhubKMR_bot' },
            children: ['@EduhubKMR_bot'],
          },
          ' - QuizBot',
        ],
      },
            {
        tag: 'li',
        children: [
          {
            tag: 'a',
            attrs: { href: 'https://t.me/NEETPW01' },
            children: ['@NEETPW01'],
          },
          ' - Group For Discussion',
        ],
      },
            {
        tag: 'li',
        children: [
          {
            tag: 'a',
            attrs: { href: 'https://t.me/NEETUG_26' },
            children: ['@NEETUG_26'],
          },
          ' - NEET JEE Channel',
        ],
      },
      
    ],
  },
];

async function createTelegraphAccount() {
  try {
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
      throw new Error(data.error || 'Telegraph account creation failed');
    }
  } catch (error) {
    console.error('Failed to create Telegraph account:', error);
    throw error;
  }
}

async function createTelegraphPageForMatches(query: string, matches: MaterialItem[]): Promise<string> {
  if (!accessToken) {
    await createTelegraphAccount();
  }

  // Get all shortened links in parallel
  const links = await Promise.all(
    matches.map(item => getShortenedLink(item))
  );

  const content = [
    {
      tag: 'h3',
      children: [`Results for: "${query}"`]
    },
    {
      tag: 'p',
      children: [`Found ${matches.length} study materials:`]
    },
    {
      tag: 'ul',
      children: matches.map((item, index) => ({
        tag: 'li',
        children: [
          '• ',
          {
            tag: 'a',
            attrs: { href: links[index], target: '_blank' },
            children: [item.label],
          },
          ` (${item.title})`,
        ],
      })),
    },
    {
      tag: 'hr'
    },
    {
      tag: 'h4',
      children: ['ℹ️ Resources & Instructions']
    },
    ...defaultInstructions,
    {
      tag: 'p',
      attrs: { style: 'color: gray; font-size: 0.8em' },
      children: ['Generated by Study Bot'],
    },
  ];

  try {
    const res = await fetch('https://api.telegra.ph/createPage', {
      method: 'POST',
      body: new URLSearchParams({
        access_token: accessToken!,
        title: `Study Material: ${query.substring(0, 50)}${query.length > 50 ? '...' : ''}`,
        author_name: 'Study Bot',
        content: JSON.stringify(content),
        return_content: 'true',
      }),
    });

    const data = await res.json();
    if (data.ok) return `https://telegra.ph/${data.result.path}`;
    throw new Error(data.error || 'Page creation failed');
  } catch (error) {
    console.error('Failed to create Telegraph page:', error);
    throw error;
  }
}

// -------------------- Bot Command Handler --------------------
// Initialize material data when the bot starts
initializeMaterialData().catch(console.error);

export function studySearch() {
  return async (ctx: Context) => {
    try {
      // Ensure we're handling a text message
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

      // Perform search
      const matches = matchMaterial(query);
      if (matches.length === 0) {
        await ctx.reply(
          `❌ ${mention}, no materials found for "${query}".`,
          { reply_to_message_id: ctx.message.message_id }
        );
        return;
      }

      // Create and send results
      const url = await createTelegraphPageForMatches(query, matches);
      const shortQuery = query.split(/\s+/).slice(0, 3).join(' ');
      
      await ctx.reply(
        `🔍 ${mention}, found *${matches.length}* matches for *${shortQuery}*:\n[View materials](${url})`,
        {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_to_message_id: ctx.message.message_id,
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
