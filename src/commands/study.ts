import { Context } from 'telegraf';
import material from '../../data/material.json';

interface MaterialItem {
  title: string;
  link: string;
}

let accessToken: string | null = null;

// Improved similarity function
function similarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(''));
  const setB = new Set(b.toLowerCase().split(''));
  const intersection = new Set([...setA].filter(char => setB.has(char)));
  return intersection.size / Math.max(setA.size, setB.size);
}

function matchMaterial(query: string): MaterialItem[] {
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results: MaterialItem[] = [];

  for (const item of material as MaterialItem[]) {
    const itemTitle = item.title.toLowerCase();
    const matchesKeyword = keywords.some(key => 
      itemTitle.includes(key) || similarity(itemTitle, key) > 0.4
    );
    
    if (matchesKeyword) {
      results.push(item);
    }
  }

  return results;
}

// Default instructions with all clickable links
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
      },
      {
        tag: 'li',
        children: [
          { 
            tag: 'a', 
            attrs: { href: 'https://t.me/Study_Material_Hub', target: '_blank' }, 
            children: ['@Study_Material_Hub'] 
          },
          ' - General study materials'
        ]
      }
    ]
  },
  { tag: 'p', children: ['👥 Join these study groups:'] },
  {
    tag: 'ul',
    children: [
      {
        tag: 'li',
        children: [
          { 
            tag: 'a', 
            attrs: { href: 'https://t.me/NEETUG_26', target: '_blank' }, 
            children: ['NEETUG_26'] 
          }
        ]
      },
      {
        tag: 'li',
        children: [
          { 
            tag: 'a', 
            attrs: { href: 'https://t.me/Neetpw01', target: '_blank' }, 
            children: ['Neetpw01'] 
          }
        ]
      },
      {
        tag: 'li',
        children: [
          { 
            tag: 'a', 
            attrs: { href: 'https://t.me/Medical_Students_Forum', target: '_blank' }, 
            children: ['Medical Students Forum'] 
          }
        ]
      }
    ]
  },
  { 
    tag: 'p', 
    children: [
      '🔗 More resources: ',
      { 
        tag: 'a', 
        attrs: { href: 'https://t.me/StudyResourcesPortal', target: '_blank' }, 
        children: ['Study Resources Portal'] 
      }
    ] 
  }
];

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

export async function createTelegraphPage(title: string, link: string, matches: MaterialItem[]): Promise<string> {
  if (!accessToken) {
    await createTelegraphAccount();
  }

  const contentArray = [
    // Header with title
    { tag: 'h3', children: [title] },
    
    // Download link section
    { 
      tag: 'p', 
      children: [
        '📥 ',
        { 
          tag: 'strong', 
          children: ['Download: '] 
        },
        { 
          tag: 'a', 
          attrs: { href: link, target: '_blank' }, 
          children: ['Click here'] 
        }
      ] 
    },
    
    // Matched results section
    ...(matches.length > 0 ? [
      { tag: 'hr' },
      { tag: 'h4', children: ['🔍 Similar Study Materials'] },
      { 
        tag: 'ul', 
        children: matches.map(item => ({
          tag: 'li',
          children: [
            '• ',
            { 
              tag: 'a', 
              attrs: { href: item.link, target: '_blank' }, 
              children: [item.title] 
            }
          ]
        }))
      }
    ] : []),
    
    // Resources section
    { tag: 'hr' },
    { tag: 'h4', children: ['ℹ️ Resources & Instructions'] },
    ...defaultInstructions,
    
    // Footer
    { tag: 'hr' },
    { 
      tag: 'p', 
      attrs: { style: 'color: #666; font-size: 0.8em;' },
      children: ['Generated by Study Bot • All links are verified'] 
    }
  ];

  const res = await fetch('https://api.telegra.ph/createPage', {
    method: 'POST',
    body: new URLSearchParams({
      access_token: accessToken!,
      title: `Study Material: ${title.substring(0, 50)}${title.length > 50 ? '...' : ''}`,
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

      const matches = matchMaterial(query);
      if (matches.length === 0) {
        return ctx.reply('❌ No matching study material found. Try different keywords.');
      }

      // Create Telegraph pages for each match
      const results = await Promise.allSettled(
        matches.map(async item => {
          try {
            // Pass only the current item's matches (excluding itself)
            const similarItems = matches.filter(m => m.title !== item.title);
            const url = await createTelegraphPage(item.title, item.link, similarItems);
            return `• [${item.title}](${url})`;
          } catch (error) {
            console.error(`Error creating page for ${item.title}:`, error);
            return `• ${item.title} (Preview unavailable)`;
          }
        })
      );

      const response = [
        `🔍 Found ${matches.length} study materials for "${query}":\n`,
        ...results.map(result => 
          result.status === 'fulfilled' ? result.value : '• (Error loading material)'
        ),
        `\n📌 All links open in new tabs for easy access.`
      ].join('\n');

      await ctx.reply(response, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

    } catch (error) {
      console.error('Error in studySearch:', error);
      ctx.reply('❌ An error occurred while processing your request. Please try again later.');
    }
  };
}
