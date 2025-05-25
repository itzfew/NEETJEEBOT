import { Context } from 'telegraf';
import { Cashfree } from 'cashfree-pg';
import material from '../../data/material.json';
import { saveToFirebase } from '../utils/saveToFirebase';
import { db } from '../utils/firebase';
import { get, ref, set } from 'firebase/database';

// Initialize Cashfree SDK
if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) {
  throw new Error('Cashfree client ID or secret is missing');
}
Cashfree.XEnvironment = process.env.CASHFREE_ENV === 'production' ? Cashfree.Environment.PRODUCTION : Cashfree.Environment.SANDBOX;
const cashfree = new Cashfree({
  clientId: process.env.CASHFREE_CLIENT_ID,
  clientSecret: process.env.CASHFREE_CLIENT_SECRET,
});

// Bot instance for webhook notifications (assuming Telegraf bot is initialized elsewhere)
import { bot } from './bot'; // Adjust path to your Telegraf bot instance

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
let isMaterialDataInitialized = false;

// Initialize material data with Telegram links
async function initializeMaterialData(): Promise<void> {
  try {
    const output: MaterialItem[] = [];
    for (const cat of material) {
      for (const item of cat.items) {
        const tgLink = `https://t.me/Material_eduhubkmrbot?start=${item.key}`;
        output.push({
          title: cat.title,
          label: item.label,
          key: item.key,
          telegramLink: tgLink,
          productId: `prod_${item.key}_${Date.now()}`,
        });
      }
    }
    materialData = output;
    isMaterialDataInitialized = true;
  } catch (error) {
    console.error('Failed to initialize material data:', error);
    throw error;
  }
}

// Ensure material data is initialized before starting the bot
initializeMaterialData().catch((err) => {
  console.error('Initialization failed:', err);
  process.exit(1); // Exit if initialization fails
});

// Check if user has paid for a specific product
async function checkPaymentStatus(userId: string, productId: string): Promise<boolean> {
  try {
    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      const userData = snapshot.val() as UserData;
      return userData.paymentStatus?.[productId] === true;
    }
    return false;
  } catch (error) {
    console.error(`Error checking payment status for user ${userId}:`, error);
    return false;
  }
}

// Save payment status to Firebase
async function savePaymentStatus(userId: string, productId: string): Promise<void> {
  try {
    const userRef = ref(db, `users/${userId}/paymentStatus/${productId}`);
    await set(userRef, true);
  } catch (error) {
    console.error(`Error saving payment status for user ${userId}, product ${productId}:`, error);
    throw error;
  }
}

// Search for materials and rank them
function rankedMatches(query: string): MaterialItem[] {
  if (!isMaterialDataInitialized) {
    throw new Error('Material data not initialized');
  }
  const queryWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const results: { item: MaterialItem; rank: number }[] = [];

  for (const item of materialData) {
    const fullText = `${item.title} ${item.label}`.toLowerCase();
    const fullWords = new Set(fullText.split(/\s+/));
    const matchedWords = queryWords.filter((word) => fullWords.has(word));
    const rank = Math.round((matchedWords.length / queryWords.length) * 100);
    if (rank > 0) {
      results.push({ item, rank });
    }
  }

  return results.sort((a, b) => b.rank - a.rank).map((r) => r.item);
}

// Create a Telegraph page with results
async function createTelegraphPageForMatches(query: string, matches: MaterialItem[], userId: string): Promise<string> {
  if (!process.env.TELEGRAPH_ACCESS_TOKEN) {
    throw new Error('Telegraph access token is missing');
  }
  const accessToken = process.env.TELEGRAPH_ACCESS_TOKEN;
  const content = [
    { tag: 'h3', children: [`Results for: "${query}"`] },
    { tag: 'p', children: [`Found ${matches.length} study materials:`] },
    {
      tag: 'ul',
      children: await Promise.all(
        matches.map(async (item) => {
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
        })
      ),
    },
    { tag: 'hr' },
    { tag: 'h4', children: ['ℹ️ Resources & Instructions'] },
    ...defaultInstructions,
    { tag: 'p', attrs: { style: 'color: gray; font-size: 0.8em' }, children: ['Generated by Study Bot'] },
  ];

  try {
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
    throw new Error(data.error || 'Failed to create Telegraph page');
  } catch (error) {
    console.error('Error creating Telegraph page:', error);
    throw error;
  }
}

// Default Telegraph instructions
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

// Bot handler
export function cashStudySearch() {
  return async (ctx: Context) => {
    try {
      // Restrict to private chats
      if (ctx.chat?.type !== 'private') {
        await ctx.reply('❌ This command is only available in private chats.', {
          reply_to_message_id: ctx.message?.message_id,
        });
        return;
      }

      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('❌ No search query provided.', { reply_to_message_id: ctx.message?.message_id });
        return;
      }

      const query = ctx.message.text.trim();
      if (!query) {
        await ctx.reply('❌ Please enter a search term.', { reply_to_message_id: ctx.message.message_id });
        return;
      }

      // Extract user details
      const user = ctx.from;
      if (!user || !user.id) {
        await ctx.reply('❌ Unable to fetch user details.', { reply_to_message_id: ctx.message.message_id });
        return;
      }

      const userId = String(user.id);
      const userData: UserData = {
        id: userId,
        name: user.first_name || '',
        username: user.username || '',
      };

      // Save user to Firebase
      await saveToFirebase(user);

      // Check if user has provided phone and email
      const userRef = ref(db, `users/${userId}`);
      const snapshot = await get(userRef);
      let userDetails = snapshot.exists() ? snapshot.val() : userData;

      if (!userDetails.phone || !userDetails.email) {
        await ctx.reply(
          '📋 Please provide your phone number and email to proceed with payments. Reply with: /setcontact <phone> <email>',
          { reply_to_message_id: ctx.message.message_id }
        );
        return;
      }

      // Search for materials
      const matches = rankedMatches(query);
      if (matches.length === 0) {
        await ctx.reply(`❌ ${user.first_name || ''}, no materials found for "${query}".`, {
          reply_to_message_id: ctx.message.message_id,
        });
        return;
      }

      // Create Telegraph page
      const telegraphURL = await createTelegraphPageForMatches(query, matches, userId);
      const shortQuery = query.split(/\s+/).slice(0, 3).join(' ');

      await ctx.reply(
        `🔍 ${user.first_name || ''}, found *${matches.length}* matches for *${shortQuery}*:\n[View materials](${telegraphURL})`,
        {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_to_message_id: ctx.message.message_id,
        }
      );
    } catch (err) {
      console.error('Error in cashStudySearch:', err);
      await ctx.reply('❌ Something went wrong. Please try again later.', {
        reply_to_message_id: ctx.message?.message_id,
      });
    }
  };
}

// Handle contact setting command
export function setContact() {
  return async (ctx: Context) => {
    try {
      if (ctx.chat?.type !== 'private') {
        await ctx.reply('❌ This command is only available in private chats.', {
          reply_to_message_id: ctx.message?.message_id,
        });
        return;
      }

      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('❌ No contact details provided.', { reply_to_message_id: ctx.message.message_id });
        return;
      }

      const args = ctx.message.text.split(' ').slice(1);
      if (args.length < 2) {
        await ctx.reply('❌ Usage: /setcontact <phone> <email>', { reply_to_message_id: ctx.message.message_id });
        return;
      }

      const [phone, email] = args;
      const userId = String(ctx.from?.id);
      if (!userId) {
        await ctx.reply('❌ Unable to fetch user details.', { reply_to_message_id: ctx.message.message_id });
        return;
      }

      // Validate phone and email
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!phoneRegex.test(phone) || !emailRegex.test(email)) {
        await ctx.reply('❌ Invalid phone or email format.', { reply_to_message_id: ctx.message.message_id });
        return;
      }

      // Save contact details to Firebase
      await set(ref(db, `users/${userId}`), {
        ...ctx.from,
        phone,
        email,
        savedAt: new Date().toISOString(),
      });

      await ctx.reply('✅ Contact details saved successfully!', { reply_to_message_id: ctx.message.message_id });
    } catch (err) {
      console.error('Error in setContact:', err);
      await ctx.reply('❌ Failed to save contact details.', { reply_to_message_id: ctx.message.message_id });
    }
  };
}

// Webhook handler for Cashfree payment confirmation
export async function handleWebhook(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const webhookData = req.body;
    const orderId = webhookData.order_id;
    const paymentStatus = webhookData.payment_status;

    if (paymentStatus === 'SUCCESS') {
      // Fetch order details
      const order = await cashfree.PGOrderFetch({ orderId });
      if (!order?.customer_details?.customer_id || !order?.order_meta?.product_id) {
        throw new Error('Missing customer_id or product_id in order details');
      }

      const userId = order.customer_details.customer_id;
      const productId = order.order_meta.product_id;

      // Update payment status in Firebase
      await savePaymentStatus(userId, productId);

      // Find the material item to get the Telegram link
      const materialItem = materialData.find((item) => item.productId === productId);
      if (!materialItem) {
        throw new Error(`Material item not found for productId: ${productId}`);
      }

      // Notify user via Telegram
      await bot.telegram.sendMessage(
        userId,
        `✅ Payment successful for "${materialItem.label}"! Access it here: ${materialItem.telegramLink}`,
        { parse_mode: 'Markdown' }
      );

      return res.status(200).json({ success: true });
    }

    return res.status(200).json({ success: false, message: 'Payment not successful' });
  } catch (error) {
    console.error('Webhook processing failed:', error);
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
}
