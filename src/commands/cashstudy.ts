import { Context } from 'telegraf';
import { Cashfree } from 'cashfree-pg';
import material from '../../data/material.json';
import { saveToFirebase } from '../utils/saveToFirebase';
import { db } from '../utils/firebase';
import { get, ref, set } from 'firebase/database';

// Setup Cashfree
Cashfree.XEnvironment = process.env.CASHFREE_ENV === 'production'
  ? Cashfree.Environment.PRODUCTION
  : Cashfree.Environment.SANDBOX;

const cashfree = new Cashfree({
  clientId: process.env.CASHFREE_CLIENT_ID!,
  clientSecret: process.env.CASHFREE_CLIENT_SECRET!,
});

interface MaterialItem {
  title: string;
  label: string;
  key: string;
  telegramLink: string;
  productId: string;
}

interface UserData {
  id: string;
  name: string;
  username: string;
  phone?: string;
  email?: string;
  paymentStatus?: { [productId: string]: boolean };
}

let materialData: MaterialItem[] = [];

async function initializeMaterialData() {
  const output: MaterialItem[] = [];
  for (const cat of material) {
    for (const item of cat.items) {
      const tgLink = `https://t.me/Material_eduhubkmrbot?start=${item.key}`;
      output.push({
        title: cat.title,
        label: item.label,
        key: item.key,
        telegramLink: tgLink,
        productId: `prod_${item.key}`, // Keep fixed product ID
      });
    }
  }
  materialData = output;
}
initializeMaterialData().catch(console.error);

async function checkPaymentStatus(userId: string, productId: string): Promise<boolean> {
  const userRef = ref(db, `users/${userId}`);
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    const userData = snapshot.val() as UserData;
    return userData.paymentStatus?.[productId] === true;
  }
  return false;
}

async function savePaymentStatus(userId: string, productId: string): Promise<void> {
  await set(ref(db, `users/${userId}/paymentStatus/${productId}`), true);
}

function rankedMatches(query: string): MaterialItem[] {
  const queryWords = query.toLowerCase().trim().split(/\s+/);
  const results: { item: MaterialItem; rank: number }[] = [];

  for (const item of materialData) {
    const fullText = `${item.title} ${item.label}`.toLowerCase();
    const fullWords = new Set(fullText.split(/\s+/));
    const matchedWords = queryWords.filter(word => fullWords.has(word));
    const rank = Math.round((matchedWords.length / queryWords.length) * 100);
    if (rank > 0) results.push({ item, rank });
  }

  return results.sort((a, b) => b.rank - a.rank).map(r => r.item);
}

async function createTelegraphAccount(): Promise<string> {
  const res = await fetch('https://api.telegra.ph/createAccount', {
    method: 'POST',
    body: new URLSearchParams({ short_name: 'studybot', author_name: 'Study Bot' }),
  });
  const data = await res.json();
  if (data.ok) return data.result.access_token;
  throw new Error(data.error);
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
    tag: 'p',
    children: ['📚 Join more recommended bots:'],
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

async function createTelegraphPageForMatches(query: string, matches: MaterialItem[], userId: string): Promise<string> {
  const accessToken = process.env.TELEGRAPH_ACCESS_TOKEN || await createTelegraphAccount();

  const content = [
    { tag: 'h3', children: [`Results for: "${query}"`] },
    { tag: 'p', children: [`Found ${matches.length} study materials:`] },
    {
      tag: 'ul',
      children: await Promise.all(matches.map(async (item) => {
        const isPaid = await checkPaymentStatus(userId, item.productId);
        const link = isPaid
          ? item.telegramLink
          : `${process.env.NEXT_PUBLIC_BASE_URL}/pay?productId=${item.productId}&userId=${userId}`;
        return {
          tag: 'li',
          children: [
            '• ',
            { tag: 'a', attrs: { href: link, target: '_blank' }, children: [item.label] },
            ` (${item.title})`,
          ],
        };
      })),
    },
    { tag: 'hr' },
    { tag: 'h4', children: ['ℹ️ Resources & Instructions'] },
    ...defaultInstructions,
    { tag: 'p', attrs: { style: 'color: gray; font-size: 0.8em' }, children: ['Generated by Study Bot'] },
  ];

  const res = await fetch('https://api.telegra.ph/createPage', {
    method: 'POST',
    body: new URLSearchParams({
      access_token: accessToken,
      title: `Study Material: ${query.slice(0, 50)}`,
      author_name: 'Study Bot',
      content: JSON.stringify(content),
      return_content: 'true',
    }),
  });

  const data = await res.json();
  if (data.ok) return `https://telegra.ph/${data.result.path}`;
  throw new Error(data.error);
}

// Handler: /setcontact <phone> <email>
export function setContact() {
  return async (ctx: Context) => {
    if (!ctx.message || !('text' in ctx.message)) return;
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) {
      return ctx.reply('❌ Usage: /setcontact <phone> <email>', { reply_to_message_id: ctx.message.message_id });
    }

    const [phone, email] = args;
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!phoneRegex.test(phone) || !emailRegex.test(email)) {
      return ctx.reply('❌ Invalid phone or email format.', { reply_to_message_id: ctx.message.message_id });
    }

    const userId = String(ctx.from?.id);
    await set(ref(db, `users/${userId}/phone`), phone);
    await set(ref(db, `users/${userId}/email`), email);
    await ctx.reply('✅ Contact details saved successfully!', { reply_to_message_id: ctx.message.message_id });
  };
}

// Main command to search materials
export function cashStudySearch() {
  return async (ctx: Context) => {
    try {
      if (!ctx.message || !('text' in ctx.message)) return;
      const query = ctx.message.text.trim();
      if (!query) {
        return ctx.reply('❌ Please enter a search term.', { reply_to_message_id: ctx.message.message_id });
      }

      const user = ctx.from;
      if (!user) {
        return ctx.reply('❌ Unable to fetch user details.', { reply_to_message_id: ctx.message.message_id });
      }

      const userId = String(user.id);
      await saveToFirebase(user);

      const snapshot = await get(ref(db, `users/${userId}`));
      const userDetails = snapshot.exists() ? snapshot.val() : {};

      if (!userDetails.phone || !userDetails.email) {
        return ctx.reply(
          '📋 Please provide your phone and email using /setcontact <phone> <email>',
          { reply_to_message_id: ctx.message.message_id }
        );
      }

      const matches = rankedMatches(query);
      if (matches.length === 0) {
        return ctx.reply(`❌ No materials found for "${query}".`, {
          reply_to_message_id: ctx.message.message_id,
        });
      }

      const telegraphURL = await createTelegraphPageForMatches(query, matches, userId);
      const shortQuery = query.split(/\s+/).slice(0, 3).join(' ');
      const mention = ctx.chat?.type?.includes('group') && user.username ? `@${user.username}` : user.first_name;

      await ctx.reply(
        `🔍 ${mention}, found *${matches.length}* matches for *${shortQuery}*:\n[View materials](${telegraphURL})`,
        {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_to_message_id: ctx.message.message_id,
        }
      );
    } catch (err) {
      console.error(err);
      await ctx.reply('❌ Something went wrong. Please try again later.', {
        reply_to_message_id: ctx.message?.message_id,
      });
    }
  };
}
