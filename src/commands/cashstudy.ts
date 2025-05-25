import { Telegraf } from 'telegraf';
import axios from 'axios';
import materialData from '../../data/material.json';
import { db } from '../utils/firebase'; // Realtime Database
import { ref, get, set } from 'firebase/database';

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, '-');
}

export function cashStudySearch() {
  return async (ctx) => {
    const queryRaw = ctx.message.text.split(' ').slice(1).join(' ').trim();
    const query = normalize(queryRaw);

    if (!query) return ctx.reply('Please provide a search term. Example: /search Physics');

    const userId = ctx.from.id.toString();
    const userSearchRef = ref(db, `payments/${userId}/queries/${query}`);
    const snapshot = await get(userSearchRef);

    if (!snapshot.exists()) {
      // Not paid for this query → Generate payment
      const amount = 29;
      const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const telegramLink = query;

      try {
        const response = await axios.post(
          'https://api.cashfree.com/pg/orders',
          {
            order_id: orderId,
            order_amount: amount,
            order_currency: 'INR',
            customer_details: {
              customer_id: `tg_${userId}`,
              customer_name: `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim(),
              customer_email: `user${userId}@bot.com`,
              customer_phone: '9999999999',
            },
            order_meta: {
              return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success?order_id={order_id}&query=${query}`,
              notify_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook`,
            },
            order_note: telegramLink,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-version': '2022-09-01',
              'x-client-id': process.env.CASHFREE_CLIENT_ID!,
              'x-client-secret': process.env.CASHFREE_CLIENT_SECRET!,
            },
          }
        );

        const paymentSessionId = response.data.payment_session_id;
        const checkoutUrl = `https://www.cashfree.com/checkout/post/redirect?payment_session_id=${paymentSessionId}`;

        return ctx.replyWithMarkdown(
          `❌ You haven't paid to access results for "*${queryRaw}*".\n\n💳 *Price*: ₹${amount}\n\nClick below to pay:\n[Pay Now](${checkoutUrl})`,
          { disable_web_page_preview: true }
        );
      } catch (err) {
        console.error('Cashfree error:', err?.response?.data || err.message);
        return ctx.reply('Payment creation failed. Try again later.');
      }
    }

    // Already paid → Show results
    const matches: { label: string; key: string }[] = [];

    for (const category of materialData as any[]) {
      for (const item of category.items) {
        if (normalize(item.label).includes(query)) {
          matches.push(item);
        }
      }
    }

    if (matches.length === 0) {
      return ctx.reply('No matching study materials found.');
    }

    const message = matches
      .map((item, i) => `${i + 1}. ${item.label} - /buy_${item.key}`)
      .join('\n');

    return ctx.reply(`Found ${matches.length} item(s):\n\n${message}`);
  };
}

export async function setupBuyCommands(bot: Telegraf) {
  for (const category of materialData as any[]) {
    for (const item of category.items) {
      const command = `buy_${item.key}`;

      bot.command(command, async (ctx) => {
        const telegramUser = ctx.from;
        const productId = item.key;
        const productName = item.label;
        const amount = 49;
        const telegramLink = `https://t.me/yourchannel/${item.key}`;

        const orderId = `ORDER_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        try {
          const response = await axios.post(
            'https://api.cashfree.com/pg/orders',
            {
              order_id: orderId,
              order_amount: amount,
              order_currency: 'INR',
              customer_details: {
                customer_id: `tg_${telegramUser.id}`,
                customer_name: `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim(),
                customer_email: `user${telegramUser.id}@bot.com`,
                customer_phone: '9999999999',
              },
              order_meta: {
                return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success?order_id={order_id}&product_id=${productId}`,
                notify_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook`,
              },
              order_note: telegramLink,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'x-api-version': '2022-09-01',
                'x-client-id': process.env.CASHFREE_CLIENT_ID!,
                'x-client-secret': process.env.CASHFREE_CLIENT_SECRET!,
              },
            }
          );

          const paymentSessionId = response.data.payment_session_id;
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
