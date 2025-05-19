import { ref, push } from 'firebase/database';
import { db } from './firebase';

export const logMessage = async (chatId: number, message: string, from: any) => {
  const date = new Date().toISOString().split('T')[0];
  const logsRef = ref(db, `logs/${date}`);

  await push(logsRef, {
    chatId,
    message,
    username: from?.username || '',
    first_name: from?.first_name || '',
    timestamp: new Date().toISOString(),
  });
};
