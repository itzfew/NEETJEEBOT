// src/utils/logStore.ts
import { google } from 'googleapis';

const SHEET_ID = '1BB4PfC4rL9Py5D9zyj0N15EZ2TiYKfuozw44NHqdvsk'; // Hardcoded sheet ID
const RANGE = 'Logs!A:D'; // Sheet name and range

export const getLogsFromSheet = async () => {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGE,
  });

  const rows = res.data.values || [];

  return rows
    .filter(row => row.length >= 4)
    .map((row) => ({
      timestamp: row[0],
      userId: row[1],
      username: row[2],
      message: row[3],
    }));
};
