import { Context } from 'telegraf';
import material from '../../data/material.json';
import { fetch } from 'undici';

interface MaterialItem {
  title: string;
  label: string;
  key: string;
  telegramLink: string;
  shortenedLink: string | null;
  matchScore?: number; // New field to store match quality
}

// Cache for shortened links
const linkCache = new Map<string, string>();
let accessToken: string | null = null;
const ADRINO_API_KEY = '5a2539904639474b5f3da41f528199204eb76f65';

// -------------------- Helpers --------------------
function createTelegramLink(key: string): string {
  return `https://t.me/Material_eduhubkmrbot?start=${key}`;
}

async function shortenLink(link: string, alias: string): Promise<string> {
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

// New improved matching function with tiered scoring
function calculateMatchScore(query: string, item: MaterialItem): number {
  const queryParts = query.toLowerCase().split(/\s+/).filter(p => p.length > 0);
  const text = `${item.title} ${item.label}`.toLowerCase();
  
  // Exact match check
  if (text.includes(query.toLowerCase())) return 1.0;
  
  // Check for all query parts existing in text (ordered or not)
  const allPartsExist = queryParts.every(part => text.includes(part));
  if (allPartsExist) return 0.9;
  
  // Check for partial matches
  let matchedParts = 0;
  for (const part of queryParts) {
    if (text.includes(part)) matchedParts++;
  }
  
  // If most parts match, return high score
  if (matchedParts / queryParts.length >= 0.8) return 0.8;
  if (matchedParts / queryParts.length >= 0.6) return 0.6;
  
  // Check for fuzzy matches using Levenshtein distance
  const levenshteinDistance = (a: string, b: string): number => {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  };

  // Calculate fuzzy match score
  let fuzzyScore = 0;
  for (const part of queryParts) {
    let bestDistance = Infinity;
    for (const word of text.split(/\s+/)) {
      const distance = levenshteinDistance(part, word);
      if (distance < bestDistance) bestDistance = distance;
    }
    // Normalize score based on word length
    const normalizedScore = Math.max(0, (part.length - bestDistance) / part.length);
    fuzzyScore += normalizedScore;
  }
  fuzzyScore /= queryParts.length;
  
  return Math.max(fuzzyScore, 0.3); // Minimum score threshold
}

// -------------------- Prepare & Match --------------------
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

function matchMaterial(query: string): MaterialItem[] {
  // Calculate scores for all items
  const scoredItems = materialData.map(item => ({
    ...item,
    matchScore: calculateMatchScore(query, item)
  }));

  // Filter items with score >= 0.3 (adjust threshold as needed)
  const matches = scoredItems.filter(item => item.matchScore >= 0.3);
  
  // Sort by match score (descending) then by title/label
  matches.sort((a, b) => {
    if (b.matchScore! !== a.matchScore!) {
      return b.matchScore! - a.matchScore!;
    }
    return a.title.localeCompare(b.title) || a.label.localeCompare(b.label);
  });

  return matches;
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

async function createTelegraphAccount(): Promise<void> {
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

  // Group by match score for better presentation
  const scoreGroups = new Map<number, MaterialItem[]>();
  matches.forEach((item, index) => {
    const roundedScore = Math.round(item.matchScore! * 10) / 10;
    if (!scoreGroups.has(roundedScore)) {
      scoreGroups.set(roundedScore, []);
    }
    scoreGroups.get(roundedScore)!.push({...item, shortenedLink: links[index]});
  });

  const content = [
    {
      tag: 'h3',
      children: [`Results for: "${query}"`]
    },
    {
      tag: 'p',
      children: [`Found ${matches.length} study materials:`]
    },
    // Add sections for each match quality tier
    ...[...scoreGroups.entries()].sort((a, b) => b[0] - a[0]).map(([score, items]) => ({
      tag: 'div',
      children: [
        {
          tag: 'h4',
          children: [
            score === 1 ? '🔍 Exact matches' : 
            score >= 0.9 ? '🔍 Very close matches' :
            score >= 0.8 ? '🔍 Close matches' :
            score >= 0.6 ? '🔍 Relevant matches' : '🔍 Possible matches'
          ]
        },
        {
          tag: 'ul',
          children: items.map(item => ({
            tag: 'li',
            children: [
              '• ',
              {
                tag: 'a',
                attrs: { href: item.shortenedLink!, target: '_blank' },
                children: [item.label],
              },
              ` (${item.title})`,
              score < 1 && score >= 0.6 ? ` [~${Math.round(score * 100)}% match]` : ''
            ],
          })),
        },
      ],
    })),
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

      const matches = matchMaterial(query);
      if (matches.length === 0) {
        await ctx.reply(
          `❌ ${mention}, no materials found for "${query}".`,
          { reply_to_message_id: ctx.message.message_id }
        );
        return;
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
