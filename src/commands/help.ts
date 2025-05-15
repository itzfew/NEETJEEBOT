import { Context } from 'telegraf';
import data from '../pdf.json';
import createDebug from 'debug';
import { Markup } from 'telegraf';

const debug = createDebug('bot:help_command');
const ITEMS_PER_PAGE = 4;

// Escape MarkdownV2 special characters
const escape = (text: string): string =>
  text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');

const help = () => async (ctx: Context) => {
  await sendPage(ctx, 0, false);
};

const sendPage = async (ctx: Context, page: number, edit = false) => {
  const start = page * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const section = data.slice(start, end);

  let message = `*♡ 𝐓𝐄𝐀𝐌 EDUHUB\\-KMR 𝐂𝐇𝐄𝐂𝐊𝐋𝐈𝐒𝐓 ॐ*\n────────┉┈◈◉◈┈┉───────\n`;

  for (const block of section) {
    message += `*ꕥ ${escape(block.title)}*\n`;
    for (const item of block.items) {
      message += `➥ [${escape(item.label)}](https://t.me/Material_eduhubkmrbot?start=${item.key})\n`;
    }
    message += `────────┉┈◈◉◈┈┉───────\n`;
  }

  const keyboard = [];

  if (page > 0) {
    keyboard.push([{ text: '⬅ Previous', callback_data: `help_page_${page - 1}` }]);
  }
  if (end < data.length) {
    keyboard.push([{ text: 'Next ➡', callback_data: `help_page_${page + 1}` }]);
  }

  const markup = Markup.inlineKeyboard(keyboard).reply_markup;

  if (edit && 'editMessageText' in ctx) {
    await ctx.editMessageText(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: markup,
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: markup,
    });
  }
};

const handleHelpPagination = () => async (ctx: Context) => {
  const callbackQuery = ctx.callbackQuery;

  if (callbackQuery && 'data' in callbackQuery) {
    const match = callbackQuery.data.match(/help_page_(\d+)/);
    if (!match) return;

    const page = parseInt(match[1]);
    await ctx.answerCbQuery();
    await sendPage(ctx, page, true); // true = edit mode
  }
};

export { help, handleHelpPagination };
