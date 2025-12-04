import * as fs from 'fs';
import * as path from 'path';
import { Storage } from '@google-cloud/storage';

export interface AttendanceData {
  [eventId: string]: {
    [userId: string]: {
      status: 'attending' | 'not_attending';
      timestamp: string;
    };
  };
}

export interface AppConfig {
  channelId?: string;
  calendarId?: string;
  timezone?: string; // IANA timezone (e.g., 'America/New_York', 'America/Los_Angeles')
  weeklySchedule?: {
    dayOfWeek: number; // 0-6, Sunday = 0
    time: string; // HH:mm format
  };
  reminderTime?: string; // HH:mm format
  weeklyTemplate?: string;
  dailyTemplate?: string;
  allowedChannels?: string[]; // Channel IDs where restricted commands can be executed
}

const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || '';

let gcsStorage: Storage | null = null;
if (STORAGE_TYPE === 'gcs' && GCS_BUCKET_NAME) {
  gcsStorage = new Storage();
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_DIR = path.join(process.cwd(), 'config');
const ATTENDANCE_FILE = path.join(DATA_DIR, 'attendance.json');
const CONFIG_FILE = path.join(CONFIG_DIR, 'app-config.json');

// Ensure directories exist
function ensureDirectories(): void {
  if (STORAGE_TYPE === 'local') {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
  }
}

// Read from GCS
async function readFromGCS(filename: string): Promise<string | null> {
  if (!gcsStorage || !GCS_BUCKET_NAME) {
    return null;
  }
  try {
    const bucket = gcsStorage.bucket(GCS_BUCKET_NAME);
    const file = bucket.file(filename);
    const [exists] = await file.exists();
    if (!exists) {
      return null;
    }
    const [contents] = await file.download();
    return contents.toString();
  } catch (error) {
    console.error(`Error reading from GCS: ${error}`);
    return null;
  }
}

// Write to GCS
async function writeToGCS(filename: string, content: string): Promise<void> {
  if (!gcsStorage || !GCS_BUCKET_NAME) {
    throw new Error('GCS storage not configured');
  }
  const bucket = gcsStorage.bucket(GCS_BUCKET_NAME);
  const file = bucket.file(filename);
  await file.save(content, {
    contentType: 'application/json',
  });
}

// Attendance storage functions
export async function readAttendance(): Promise<AttendanceData> {
  ensureDirectories();
  
  if (STORAGE_TYPE === 'gcs') {
    const content = await readFromGCS('attendance.json');
    if (content) {
      try {
        return JSON.parse(content);
      } catch (error) {
        console.error('Error parsing attendance data:', error);
        return {};
      }
    }
    return {};
  } else {
    if (!fs.existsSync(ATTENDANCE_FILE)) {
      return {};
    }
    try {
      const content = fs.readFileSync(ATTENDANCE_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading attendance data:', error);
      return {};
    }
  }
}

export async function writeAttendance(data: AttendanceData): Promise<void> {
  ensureDirectories();
  const content = JSON.stringify(data, null, 2);
  
  if (STORAGE_TYPE === 'gcs') {
    await writeToGCS('attendance.json', content);
  } else {
    // Atomic write: write to temp file first, then rename
    const tempFile = `${ATTENDANCE_FILE}.tmp`;
    fs.writeFileSync(tempFile, content, 'utf-8');
    fs.renameSync(tempFile, ATTENDANCE_FILE);
  }
}

export async function updateAttendance(
  eventId: string,
  userId: string,
  status: 'attending' | 'not_attending'
): Promise<void> {
  const data = await readAttendance();
  if (!data[eventId]) {
    data[eventId] = {};
  }
  data[eventId][userId] = {
    status,
    timestamp: new Date().toISOString(),
  };
  await writeAttendance(data);
}

export async function batchUpdateAttendance(
  updates: Array<{ eventId: string; userId: string; status: 'attending' | 'not_attending' }>
): Promise<void> {
  // Single read operation
  const data = await readAttendance();
  const timestamp = new Date().toISOString();
  
  // Apply all updates in memory
  for (const update of updates) {
    if (!data[update.eventId]) {
      data[update.eventId] = {};
    }
    data[update.eventId][update.userId] = {
      status: update.status,
      timestamp,
    };
  }
  
  // Single write operation
  await writeAttendance(data);
}

// Configuration storage functions
export async function readConfig(): Promise<AppConfig> {
  ensureDirectories();
  
  if (STORAGE_TYPE === 'gcs') {
    const content = await readFromGCS('app-config.json');
    if (content) {
      try {
        return JSON.parse(content);
      } catch (error) {
        console.error('Error parsing config data:', error);
        return {};
      }
    }
    return {};
  } else {
    if (!fs.existsSync(CONFIG_FILE)) {
      return {};
    }
    try {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading config data:', error);
      return {};
    }
  }
}

export async function writeConfig(config: AppConfig): Promise<void> {
  ensureDirectories();
  const content = JSON.stringify(config, null, 2);
  
  if (STORAGE_TYPE === 'gcs') {
    await writeToGCS('app-config.json', content);
  } else {
    // Atomic write: write to temp file first, then rename
    const tempFile = `${CONFIG_FILE}.tmp`;
    fs.writeFileSync(tempFile, content, 'utf-8');
    fs.renameSync(tempFile, CONFIG_FILE);
  }
}

