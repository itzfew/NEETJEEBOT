import { Context } from 'telegraf';
import { fetchChatIdsFromFirebase } from '../utils/chatStore';

const ADMIN_ID = 6930703214;

export const setupBroadcast = (bot: any) => {
  bot.command('broadcast', async (ctx: Context) => {
    if (ctx.from?.id !== ADMIN_ID) {
      return ctx.reply('❌ You are not authorized to use this command.');
    }

    const message = ctx.message as any;
    const reply = message?.reply_to_message;

    if (!reply) {
      return ctx.reply('⚠️ Please reply to the message (text/media) you want to broadcast using /broadcast.');
    }

    try {
      // Fetch unique chat IDs to prevent duplicates
      const chatIds = [...new Set(await fetchChatIdsFromFirebase())];
      let sent = 0;

      // Track sent chat IDs to avoid duplicates within the same broadcast
      const sentChatIds = new Set<number>();

      for (const chatId of chatIds) {
        // Skip if message was already sent to this chat ID
        if (sentChatIds.has(chatId)) {
          continue;
        }

        try {
          if (reply.text) {
            await ctx.telegram.sendMessage(chatId, reply.text, {
              parse_mode: 'Markdown',
            });
          } else if (reply.photo) {
            const fileId = reply.photo[reply.photo.length - 1].file_id;
            await ctx.telegram.sendPhoto(chatId, fileId, {
              caption: reply.caption || '',
              parse_mode: 'Markdown',
            });
          } else if (reply.document) {
            await ctx.telegram.sendDocument(chatId, reply.document.file_id, {
              caption: reply.caption || '',
              parse_mode: 'Markdown',
            });
          } else if (reply.video) {
            await ctx.telegram.sendVideo(chatId, reply.video.file_id, {
              caption: reply.caption || '',
              parse_mode: 'Markdown',
            });
          } else {
            continue;
          }
          sentChatIds.add(chatId);
          sent++;
        } catch (err) {
          console.error(`Failed to send to ${chatId}:`, err);
        }
      }

      await ctx.reply(`✅ Broadcast sent to ${sent}/${chatIds.length} users.`);
    } catch (err) {
      console.error('Broadcast error:', err);
      await ctx.reply('❌ Broadcast failed.');
    }
  });
};
