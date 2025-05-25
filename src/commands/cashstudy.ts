import { Telegraf } from 'telegraf';
import axios from 'axios';
import materialData from '../../data/material.json';
import { db } from '../utils/firebase';
import { ref, get } from 'firebase/database';

const PRICE = 49;

export function cashStudySearch() {
  return async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ').toLowerCase();

    if (!query) {
      return ctx.reply('Please provide a search term. Example: /search biology');
    }

    // Check if user has paid for this query before
    const userId = ctx.from.id.toString();
    const paymentRef = ref(db, `payments/${userId}_${query}`);
    const paymentSnapshot = await get(paymentRef);
    if (!paymentSnapshot.exists()) {
      return ctx.reply(
        `You need to pay ₹${PRICE} to access study materials for "${query}".\nUse /buy_${query.replace(/\s+/g, '_')}`
      );
    }

    // If paid, show matching materials
    const matches = [];

    for (const category of materialData) {
      for (const item of category.items) {
        if (item.label.toLowerCase().includes(query)) {
          matches.push(item);
        }
      }
    }

    if (matches.length === 0) {
      return ctx.reply('No matching study materials found.');
    }

    const message = matches
      .map((item, index) => `${index + 1}. ${item.label} - Link: https://t.me/yourchannel/${item.key}`)
      .join('\n');

    return ctx.reply(`Here are your study materials for "${query}":\n\n${message}`);
  };
}

export async function setupBuyCommands(bot: Telegraf) {
  for (const category of materialData) {
    for (const item of category.items) {
      const command = `buy_${item.key}`;

      bot.command(command, async (ctx) => {
        const telegramUser = ctx.from;
        const productId = item.key;
        const productName = item.label;
        const amount = PRICE;
        const telegramLink = `https://t.me/yourchannel/${item.key}`;

        try {
          const response = await axios.post(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/createOrder`,
            {
              productId,
              productName,
              amount,
              telegramLink,
              customerName: `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim(),
              customerEmail: `user${telegramUser.id}@bot.com`, // Dummy email
              customerPhone: '9999999999', // Dummy phone
            }
          );

          if (!response.data.success) {
            return ctx.reply('Failed to create payment link. Please try again later.');
          }

          const paymentSessionId = response.data.paymentSessionId;
          const checkoutUrl = `https://www.cashfree.com/checkout/post/redirect?payment_session_id=${paymentSessionId}`;

          await ctx.replyWithMarkdown(
            `🛒 *${productName}*\n\nPrice: ₹${amount}\n\nClick below to pay:\n[Pay Now](${checkoutUrl})`,
            { disable_web_page_preview: true }
          );
        } catch (error) {
          console.error('Cashfree order creation failed:', error?.response?.data || error.message);
          return ctx.reply('Failed to create payment link. Please try again later.');
        }
      });
    }
  }
}
