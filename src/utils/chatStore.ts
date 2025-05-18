// utils/chatStore.ts
import { db } from './firebase';
import { get, ref } from 'firebase/database';

export const fetchChatIdsFromFirebase = async (): Promise<string[]> => {
  const snapshot = await get(ref(db, 'users'));
  const data = snapshot.val();
  return data ? Object.keys(data) : [];
};

export const getLogsByDate = async (date: string): Promise<string> => {
  const snapshot = await get(ref(db, `logs/${date}`));
  const logs = snapshot.val();
  const lines: string[] = [];

  if (!logs) return 'No logs found for this date.';

  for (const logId in logs) {
    const { timestamp, message, username, first_name, chatId } = logs[logId];
    const timeStr = new Date(timestamp).toISOString();
    lines.push(`[${timeStr}] (${chatId}) ${first_name} (@${username || 'N/A'}): ${message}`);
  }

  return lines.join('\n');
};
