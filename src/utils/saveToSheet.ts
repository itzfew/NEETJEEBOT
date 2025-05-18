import { db } from './firebase';
import { ref, set, get, push } from 'firebase/database';

export const saveToSheet = async (
  chat: { id: number; username?: string; first_name?: string },
  message?: string
): Promise<boolean> => {
  const userRef = ref(db, `users/${chat.id}`);
  const logRef = ref(db, `logs/${chat.id}`);

  try {
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      await set(userRef, {
        id: chat.id,
        username: chat.username || '',
        first_name: chat.first_name || '',
        joinedAt: new Date().toISOString(),
      });
      console.log('New user added to Firebase:', chat.id);
    } else {
      console.log('User already exists in Firebase:', chat.id);
    }

    if (message) {
      await push(logRef, {
        message,
        timestamp: new Date().toISOString(),
        username: chat.username || '',
        first_name: chat.first_name || '',
        user_id: chat.id,
      });
      console.log('Message logged for user:', chat.id);
    }

    return snapshot.exists(); // true if already existed
  } catch (error) {
    console.error('Firebase error:', error);
    return false;
  }
};
