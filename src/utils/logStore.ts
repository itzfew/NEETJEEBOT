// utils/logStore.ts
import { google } from 'googleapis';

const SHEET_ID = process.env.SHEET_ID!;
const RANGE = 'Logs!A:D'; // Adjust as per your sheet structure

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
  return rows.map((row) => ({
    timestamp: row[0],
    userId: row[1],
    username: row[2],
    message: row[3],
  }));
};
