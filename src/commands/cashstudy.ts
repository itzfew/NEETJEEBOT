import { Telegraf } from 'telegraf';
import axios from 'axios';
import materialData from '../../data/material.json';
import { cashfreeClientId, cashfreeClientSecret, baseUrl } from '../utils/env';

export function cashStudySearch() {
  return async (ctx) => {
    const query = ctx.message.text.split(' ').slice(1).join(' ').toLowerCase();

    if (!query) {
      return ctx.reply('Please provide a search term. Example: /search biology');
    }

    const matches: { label: string; key: string }[] = [];

    for (const category of materialData as any[]) {
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
      .map((item, index) => `${index + 1}. ${item.label} - /buy_${item.key}`)
      .join('\n');

    return ctx.reply(`Found ${matches.length} items:\n\n${message}`);
  };
}

// Register dynamic buy commands
export async function setupBuyCommands(bot: Telegraf) {
  for (const category of materialData as any[]) {
    for (const item of category.items) {
      const command = `buy_${item.key}`;

      bot.command(command, async (ctx) => {
        const telegramUser = ctx.from;
        const productId = item.key;
        const productName = item.label;
        const amount = 49; // default price, you can adjust per product if needed
        const telegramLink = `https://t.me/yourchannel/${item.key}`; // Or customize as needed

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
                customer_phone: '9999999999', // Optional placeholder
              },
              order_meta: {
                return_url: `${baseUrl}/success?order_id={order_id}&product_id=${productId}`,
                notify_url: `${baseUrl}/api/webhook`,
              },
              order_note: telegramLink,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'x-api-version': '2022-09-01',
                'x-client-id': cashfreeClientId,
                'x-client-secret': cashfreeClientSecret,
              },
            }
          );

          const paymentSessionId = response.data.payment_session_id;
          const checkoutUrl = `https://www.cashfree.com/checkout/post/redirect?payment_session_id=${paymentSessionId}`;

          await ctx.replyWithMarkdown(
            `🛒 *${productName}*\n\nPrice: ₹${amount}\n\nClick the link below to pay:\n[Pay Now](${checkoutUrl})`,
            { disable_web_page_preview: true }
          );
        } catch (error) {
          console.error(`Cashfree order creation failed:`, error?.response?.data || error.message);
          return ctx.reply('Failed to create payment link. Please try again later.');
        }
      });
    }
  }
}
