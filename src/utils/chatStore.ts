let chatIds: number[] = [];

export const saveChatId = (id: number) => {
  if (!chatIds.includes(id)) {
    chatIds.push(id);
  }
};

export const getAllChatIds = (): number[] => {
  return chatIds;
};
export const fetchChatIdsFromSheet = async (): Promise<number[]> => {
  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycbyQLYXELr3LqUOcAlmiNK_cZDxzw7jWvpAO8JxeOWRN_dwLHxG2Gju2hDLeKOn3bTgW/exec');
    const data = await response.json();

    const ids = data.map((entry: any) => Number(entry.id)).filter((id: number) => !isNaN(id));
    return ids;
  } catch (error) {
    console.error('Failed to fetch chat IDs from Google Sheet:', error);
    return [];
  }
};
