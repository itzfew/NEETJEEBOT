import axios from 'axios';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyQLYXELr3LqUOcAlmiNK_cZDxzw7jWvpAO8JxeOWRN_dwLHxG2Gju2hDLeKOn3bTgW/exec'; // replace with your actual URL

export async function logMessage({
  id,
  username,
  first_name,
  text,
  type,
  timestamp
}: {
  id: string;
  username: string;
  first_name: string;
  text: string;
  type: string;
  timestamp: string;
}) {
  try {
    await axios.post(GOOGLE_SCRIPT_URL, {
      id,
      username,
      first_name,
      text,
      type,
      timestamp
    });
  } catch (err) {
    console.error('Logging error:', err.message);
  }
}
