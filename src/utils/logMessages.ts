import fs from 'fs';
import path from 'path';

const LOGS_DIR = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

export const logMessage = (data: {
  chatId: number;
  username?: string;
  firstName?: string;
  text: string;
  timestamp: string;
}) => {
  const date = data.timestamp.split('T')[0]; // YYYY-MM-DD
  const logPath = path.join(LOGS_DIR, `${date}.txt`);
  const logLine = `[${data.timestamp}] ${data.firstName} (${data.username || 'N/A'}) [${data.chatId}]: ${data.text}\n`;
  fs.appendFileSync(logPath, logLine);
};

export const getLogFilePath = (date: string): string | null => {
  const filePath = path.join(LOGS_DIR, `${date}.txt`);
  return fs.existsSync(filePath) ? filePath : null;
};
