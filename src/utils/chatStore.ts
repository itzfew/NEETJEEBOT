// utils/chatStore.ts
import { db } from './firebase';
import { get, ref } from 'firebase/database';

export const fetchChatIdsFromFirebase = async (): Promise<string[]> => {
  const snapshot = await get(ref(db, 'users'));
  const data = snapshot.val();
  return data ? Object.keys(data) : [];
};

export const getLogsByDate = async (date: string): Promise<string> => {
  const snapshot = await get(ref(db, 'logs'));
  const logs = snapshot.val();
  const lines: string[] = [];

  for (const userId in logs) {
    const entries = logs[userId];
    for (const logId in entries) {
      const { timestamp, message, username, first_name } = entries[logId];
      if (timestamp?.startsWith(date)) {
        lines.push(`[${timestamp}] (${userId}) ${first_name} (@${username || 'N/A'}): ${message}`);
      }
    }
  }

  return lines.length ? lines.join('\n') : 'No logs found for this date.';
};
