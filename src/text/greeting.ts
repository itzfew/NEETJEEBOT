import { Context } from 'telegraf';
import createDebug from 'debug';

const debug = createDebug('bot:greeting');

// Greeting handler (only for private chats)
const greeting = () => async (ctx: Context) => {
  try {
    debug('Triggered "greeting" handler');
    const message = ctx.message;
    const chat = ctx.chat;
    const user = ctx.from;

    if (!chat || chat.type !== 'private' || !message || !user || !('text' in message)) return;

    const text = message.text.trim().toLowerCase();
    const greetings = ['hi', 'hello', 'hey', 'hii', 'heyy', 'hola', 'start', '/start'];

    if (greetings.includes(text)) {
      await ctx.reply(
        `Welcome ${user.first_name}!\n\n*Do you need any study material?*\n\nJust ask me like this:\n"Arihant Physics exemplar 11th"\n\nYou can also add me to your study group to help students with:\n- Quick material searches\n- Copyright-free resources\n- Instant answers to study queries\n\nI'll assist everyone in the group while following all copyright guidelines.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{
                text: 'Add me to your group',
                url: `https://t.me/${ctx.botInfo?.username}?startgroup=true`
              }]
            ]
          }
        }
      );
    }
  } catch (err) {
    console.error('Greeting logic error:', err);
  }
};

export { greeting };
