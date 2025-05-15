 import { Context } from 'telegraf';
import material from '../../data/material.json';
import { fetch } from 'undici';

interface MaterialItem {
  title: string;
  label: string;
  key: string;
  telegramLink: string;
  shortenedLink: string;
}

// Cache objects
let materialCache: MaterialItem[] = [];
let accessToken: string | null = null;
const ADRINO_API_KEY = '5a2539904639474b5f3da41f528199204eb76f65';
const LINK_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours cache
const linkCache = new Map<string, { link: string; timestamp: number }>();

// -------------------- Helpers --------------------
function createTelegramLink(key: string): string {
  return `https://t.me/Material_eduhubkmrbot?start=${key}`;
}

async function shortenLink(link: string, alias: string): Promise<string> {
  // Check cache first
  const cached = linkCache.get(alias);
  if (cached && Date.now() - cached.timestamp < LINK_CACHE_TTL) {
    return cached.link;
  }

  try {
    if (alias.length > 30) alias = alias.substring(0, 30);
    const url = `https://adrinolinks.in/api?api=${ADRINO_API_KEY}&url=${encodeURIComponent(link)}&alias=${alias}`;
    const res = await fetch(url);
    
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    
    const data = await res.json();
    
    if (data.status === 'success') {
      linkCache.set(alias, { link: data.shortenedUrl, timestamp: Date.now() });
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
async function prepareMaterialData(): Promise<MaterialItem[]> {
  // Return cached data if available
  if (materialCache.length > 0) return materialCache;

  const output: MaterialItem[] = [];

  for (const cat of material) {
    for (const item of cat.items) {
      const tgLink = createTelegramLink(item.key);
      const shortLink = await shortenLink(tgLink, item.key);
      output.push({
        title: cat.title,
        label: item.label,
        key: item.key,
        telegramLink: tgLink,
        shortenedLink: shortLink,
      });
    }
  }

  // Cache the prepared data
  materialCache = output;
  return output;
}

async function matchMaterial(query: string): Promise<MaterialItem[]> {
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 0);
  const all = await prepareMaterialData();

  if (keywords.length === 0) return [];

  return all.filter(item => {
    const text = `${item.title} ${item.label}`.toLowerCase();
    return keywords.some(k => text.includes(k)) || 
           keywords.every(k => similarity(text, k) > 0.4);
  });
}

// -------------------- Telegraph Integration --------------------
const defaultInstructions = [
  // ... (keep your existing defaultInstructions)
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
    console.error('Telegraph account creation error:', error);
    throw error;
  }
}

async function createTelegraphPageForMatches(query: string, matches: MaterialItem[]): Promise<string> {
  if (!accessToken) {
    await createTelegraphAccount();
  }

  const content = [
    // ... (keep your existing content structure)
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
    console.error('Telegraph page creation error:', error);
    throw error;
  }
}

// -------------------- Bot Command Handler --------------------
export function studySearch() {
  // Initialize material data on startup
  prepareMaterialData().catch(console.error);

  return async (ctx: Context) => {
    try {
      if (!ctx.message || !('text' in ctx.message)) return;

      const query = ctx.message.text.trim();
      if (!query) return ctx.reply('❌ Please enter a search term.');

      const mention = ctx.chat?.type?.includes('group') && ctx.from?.username 
        ? `@${ctx.from.username}` 
        : ctx.from?.first_name || '';

      const matches = await matchMaterial(query);
      if (matches.length === 0) {
        return ctx.reply(
          `❌ ${mention}, no materials found for "${query}".`,
          { reply_to_message_id: ctx.message.message_id }
        );
      }

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
      await ctx.reply('❌ Something went wrong. Please try again later.');
    }
  };
}
