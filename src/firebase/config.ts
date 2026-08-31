import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

declare const process: { env: Record<string, string | undefined> };

const firebaseConfig = {
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || 'https://capstonedata-3589c-default-rtdb.asia-southeast1.firebasedatabase.app/',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'capstonedata-3589c',
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBH2sYvDSKUUb1bZRN-MVGXvv5irU6QfJE',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'capstonedata-3589c.firebaseapp.com',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const database = getDatabase(app);
export const auth = getAuth(app);
