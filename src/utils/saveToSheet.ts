export const saveToSheet = async (chat: {
  id: number;
  username?: string;
  first_name?: string;
  message?: string; // Add message field
}): Promise<boolean> => {
  const payload = {
    id: String(chat.id),
    username: chat.username || '',
    first_name: chat.first_name || '',
    message: chat.message || '', // Include message
  };

  try {
    const response = await fetch(
      'https://script.google.com/macros/s/AKfycbySdlu6je3PCA-RvNXlF09K4hVKUd4aVPcUbh1lFtVJO-WJHc07swr8qQP609CNigtK/exec',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    const resultText = await response.text();
    console.log('Google Sheet response:', resultText);

    if (response.ok) {
      if (resultText.includes('Already Notified')) {
        return true;
      } else if (resultText.includes('Saved')) {
        return false;
      }
    } else {
      console.error(`Sheet API error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error in saveToSheet:', error);
  }

  return false;
};
