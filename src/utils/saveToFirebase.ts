import { ref, get, set } from 'firebase/database';
import { db } from './firebase';

interface ChatInfo {
  id: number;
  username?: string;
  first_name?: string;
}

export const saveToFirebase = async (chat: ChatInfo): Promise<boolean> => {
  const chatRef = ref(db, `users/${chat.id}`);
  const snapshot = await get(chatRef);

  if (snapshot.exists()) {
    return true; // Already exists
  } else {
    await set(chatRef, {
      id: chat.id,
      username: chat.username || '',
      first_name: chat.first_name || '',
      timestamp: Date.now(),
    });
    return false; // Newly added
  }
};
