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
    const response = await fetch('https://script.google.com/macros/s/AKfycbxm2Px6oTD8IZFnw6L3J82XJFthC7wEoknJvT_jutdm5ovHCwedxjaWbzI9XqTcSX-K/exec');
    const data = await response.json();

    const ids = data.map((entry: any) => Number(entry.id)).filter((id: number) => !isNaN(id));
    return ids;
  } catch (error) {
    console.error('Failed to fetch chat IDs from Google Sheet:', error);
    return [];
  }
};
