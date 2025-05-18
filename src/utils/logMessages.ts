import axios from 'axios';

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwAxRvC5DncdYzmpAsn7rlLB-9jqNYyEroBPaOMwF-Nq2h05QNfSlMLdeHSfK26OhGr/exec'; // replace with your actual URL

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
