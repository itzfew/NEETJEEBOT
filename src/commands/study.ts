import { Context } from 'telegraf';
import material from '../../data/material.json';

interface MaterialItem {
  title: string;
  label: string;
  key: string;
  downloadLink: string;
}

// 1. Initialize with auto-generated links
const materialDB: MaterialItem[] = material.flatMap(category => 
  category.items.map(item => ({
    title: category.title,
    label: item.label,
    key: item.key,
    downloadLink: `https://adrinolinks.in/redirect?to=${encodeURIComponent(`https://t.me/Material_eduhubkmrbot?start=${item.key}`)}`
  }))
);

// 2. Smart search function (handles Hindi/English mixes)
function searchMaterials(query: string): MaterialItem[] {
  const keywords = query.toLowerCase()
    .replace(/mujhe|dekhao|books|chahiye/g, '') // Remove common Hindi/English phrases
    .split(/\s+/)
    .filter(Boolean);

  return materialDB.filter(item => 
    keywords.some(keyword => 
      item.label.toLowerCase().includes(keyword) || 
      item.title.toLowerCase().includes(keyword)
    )
  );
}

// 3. Create dynamic Telegraph page
async function createResultsPage(query: string, matches: MaterialItem[]): Promise<string> {
  // Create account if needed (simplified)
  const { access_token } = await (await fetch('https://api.telegra.ph/createAccount', {
    method: 'POST',
    body: new URLSearchParams({ 
      short_name: 'StudyFinder',
      author_name: 'Material Bot'
    })
  })).json();

  // Build content
  const content = [
    { tag: 'h1', children: [`Search Results for "${query}"`] },
    { tag: 'hr' },
    { tag: 'h2', children: ['📚 Found Materials'] },
    ...matches.flatMap(item => [
      { 
        tag: 'div', 
        attrs: { style: 'margin-bottom: 15px;' },
        children: [
          { tag: 'h3', children: [item.label] },
          { tag: 'p', children: [`🔗 `, { 
            tag: 'a', 
            attrs: { href: item.downloadLink }, 
            children: ['Download Now'] 
          }]},
          { tag: 'p', children: [`🏷️ Category: ${item.title}`] }
        ]
      }
    ]),
    { 
      tag: 'footer', 
      attrs: { style: 'margin-top: 20px; color: #666;' },
      children: ['🔍 Search powered by @Material_eduhubkmrbot']
    }
  ];

  // Create page
  const { result } = await (await fetch('https://api.telegra.ph/createPage', {
    method: 'POST',
    body: new URLSearchParams({
      access_token,
      title: `Results for "${query.substring(0, 50)}"`,
      content: JSON.stringify(content),
      return_content: false
    })
  })).json();

  return `https://telegra.ph/${result.path}`;
}

// 4. Telegram bot handler
export function studySearch() {
  return async (ctx: Context) => {
    const query = ctx.message?.text || '';
    
    if (!query) {
      return ctx.reply('Please type what materials you need\nExample: "MTG BOOKS"');
    }

    const matches = searchMaterials(query);
    
    if (matches.length === 0) {
      return ctx.reply('No materials found. Try different keywords like "MTG", "Physics", or "PYQs"');
    }

    try {
      const telegraphUrl = await createResultsPage(query, matches);
      await ctx.reply(
        `🔍 Here's what I found for "${query}":\n\n` +
        `📚 [View All ${matches.length} Materials](${telegraphUrl})\n\n` +
        `📌 Tip: Open the link to see complete list with download options`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );
    } catch (error) {
      console.error('Error:', error);
      ctx.reply('⚠️ Could not generate results. Please try again later.');
    }
  };
}
