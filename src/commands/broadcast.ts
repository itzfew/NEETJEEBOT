import { Context } from 'telegraf';
import { fetchChatIdsFromFirebase } from '../utils/chatStore';
import { getFirestore } from 'firebase-admin/firestore';

const ADMIN_ID = 6930703214;
const db = getFirestore();

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

    // Use message_id as a unique identifier for the broadcast
    const broadcastId = reply.message_id.toString();

    try {
      // Check if this broadcast has already been sent
      const broadcastRef = db.collection('broadcasts').doc(broadcastId);
      const broadcastDoc = await broadcastRef.get();

      if (broadcastDoc.exists) {
        return ctx.reply('⚠️ This message has already been broadcasted.');
      }

      const chatIds = await fetchChatIdsFromFirebase();
      let sent = 0;

      for (const chatId of chatIds) {
        try {
          // Check if message was already sent to this chatId
          const sentRef = db.collection('broadcasts').doc(broadcastId).collection('sent').doc(chatId.toString());
          const sentDoc = await sentRef.get();

          if (sentDoc.exists) {
            continue; // Skip if already sent to this chat
          }

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

          // Mark as sent in Firebase
          await sentRef.set({ sentAt: new Date().toISOString() });
          sent++;
        } catch (err) {
          console.error(`Failed to send to ${chatId}:`, err);
        }
      }

      // Record the broadcast to prevent re-sending
      await broadcastRef.set({
        messageId: broadcastId,
        broadcastAt: new Date().toISOString(),
        totalSent: sent,
      });

      await ctx.reply(`✅ Broadcast sent to ${sent}/${chatIds.length} users.`);
    } catch (err) {
      console.error('Broadcast error:', err);
      await ctx.reply('❌ Broadcast failed.');
    }
  });
};
