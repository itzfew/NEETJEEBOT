import { Context } from 'telegraf';
import material from '../../data/material.json';

interface MaterialItem {
  title: string;
  label: string;
  key: string;
  telegramLink: string;
  shortenedLink: string;
}

let accessToken: string | null = null;
const ADRINO_API_KEY = '5a2539904639474b5f3da41f528199204eb76f65';

// Function to create Telegram deep link
function createTelegramLink(key: string): string {
  return `https://t.me/Material_eduhubkmrbot?start=${key}`;
}

// Function to shorten link via AdrinoLinks API
async function shortenLink(telegramLink: string, alias: string): Promise<string> {
  try {
    const url = `https://adrinolinks.in/api?api=${ADRINO_API_KEY}&url=${encodeURIComponent(telegramLink)}&alias=${alias}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'success' && data.shortenedUrl) {
      return data.shortenedUrl;
    }
    return telegramLink; // Fallback to original link if shortening fails
  } catch (error) {
    console.error('Error shortening link:', error);
    return telegramLink;
  }
}

// Prepare material data with links
async function prepareMaterialData(): Promise<MaterialItem[]> {
  const preparedMaterial: MaterialItem[] = [];

  for (const category of material) {
    for (const item of category.items) {
      const telegramLink = createTelegramLink(item.key);
      const shortenedLink = await shortenLink(telegramLink, item.key);

      preparedMaterial.push({
        title: category.title,
        label: item.label,
        key: item.key,
        telegramLink,
        shortenedLink
      });
    }
  }

  return preparedMaterial;
}

// Similarity function
function similarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(''));
  const setB = new Set(b.toLowerCase().split(''));
  const intersection = new Set([...setA].filter(char => setB.has(char)));
  return intersection.size / Math.max(setA.size, setB.size);
}

// Match material function
async function matchMaterial(query: string): Promise<MaterialItem[]> {
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
  const preparedMaterial = await prepareMaterialData();
  const results: MaterialItem[] = [];

  for (const item of preparedMaterial) {
    const itemText = `${item.title} ${item.label}`.toLowerCase();
    const matchesKeyword = keywords.some(key =>
      itemText.includes(key) || similarity(itemText, key) > 0.4
    );

    if (matchesKeyword) {
      results.push(item);
    }
  }

  return results;
}

// Default instructions
const defaultInstructions = [
  {
    tag: 'p',
    children: [
      '📺 For detailed instructions, watch: ',
      {
        tag: 'a',
        attrs: { href: 'https://youtube.com/watch?v=dQw4w9WgXcQ', target: '_blank' },
        children: ['YouTube Tutorial']
      }
    ]
  },
  { tag: 'p', children: ['📚 Join these channels for more resources:'] },
  {
    tag: 'ul',
    children: [
      {
        tag: 'li',
        children: [
          {
            tag: 'a',
            attrs: { href: 'https://t.me/Material_eduhubkmrbot', target: '_blank' },
            children: ['@Material_eduhubkmrbot']
          },
          ' - NEET/JEE materials'
        ]
      },
      {
        tag: 'li',
        children: [
          {
            tag: 'a',
            attrs: { href: 'https://t.me/EduhubKMR_bot', target: '_blank' },
            children: ['@EduhubKMR_bot']
          },
          ' - QuizBot for NEET subjects'
        ]
      }
    ]
  }
];

// Create Telegraph account
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
    throw new Error(data.error || 'Failed to create Telegraph account');
  }
}

// Create Telegraph page
async function createTelegraphPage(item: MaterialItem, matches: MaterialItem[]): Promise<string> {
  if (!accessToken) {
    await createTelegraphAccount();
  }

  const contentArray = [
    { tag: 'h3', children: [item.label] },
    { tag: 'p', children: [`📚 Category: ${item.title}`] },
    { 
      tag: 'p', 
      children: [ 
        '📥 ', 
        { tag: 'strong', children: ['Download: '] }, 
        { tag: 'a', attrs: { href: item.telegramLink, target: '_blank' }, children: ['Click here'] } 
      ] 
    },
    { tag: 'hr' },
    { tag: 'h4', children: ['🔍 All Matching Study Materials'] },
    { 
      tag: 'ul', 
      children: [
        ...matches.map(match => ({
          tag: 'li',
          children: [
            '• ',
            { 
              tag: 'a', 
              attrs: { href: match.telegramLink, target: '_blank' }, 
              children: [`${match.label} (${match.title})`] 
            }
          ]
        }))
      ] 
    },
    { tag: 'hr' },
    { tag: 'h4', children: ['ℹ️ Resources & Instructions'] },
    ...defaultInstructions,
    { 
      tag: 'p', 
      attrs: { style: 'color: #666; font-size: 0.8em;' }, 
      children: ['Generated by Study Bot • Links open in Telegram'] 
    }
  ];

  const res = await fetch('https://api.telegra.ph/createPage', {
    method: 'POST',
    body: new URLSearchParams({
      access_token: accessToken!,
      title: `Study Material: ${item.label.substring(0, 50)}${item.label.length > 50 ? '...' : ''}`,
      author_name: 'Study Bot',
      content: JSON.stringify(contentArray),
      return_content: 'true'
    }),
  });

  const data = await res.json();
  if (data.ok) {
    return `https://telegra.ph/${data.result.path}`;
  } else {
    throw new Error(data.error || 'Failed to create Telegraph page');
  }
}

// Main search function
export function studySearch() {
  return async (ctx: Context) => {
    try {
      if (!ctx.message || !('text' in ctx.message)) {
        return ctx.reply('❌ Please send a text message to search study material.');
      }

      const query = ctx.message.text.trim();
      if (!query) {
        return ctx.reply('❌ Please enter a search term.');
      }

      // Show typing action
      await ctx.sendChatAction('typing');

      const matches = await matchMaterial(query);
      if (matches.length === 0) {
        return ctx.reply('❌ No matching study material found. Try different keywords.');
      }

      // Create a single Telegraph page with all results
      const firstItem = matches[0];
      const telegraphUrl = await createTelegraphPage(firstItem, matches);

      await ctx.reply(
        `🔍 Found ${matches.length} study materials for "${query}":\n\n` +
        `📚 View all results here: ${telegraphUrl}\n\n` +
        `ℹ️ All materials will open in Telegram for download.`,
        { disable_web_page_preview: false }
      );

    } catch (error) {
      console.error('Error in studySearch:', error);
      ctx.reply('❌ An error occurred while processing your request. Please try again later.');
    }
  };
}
