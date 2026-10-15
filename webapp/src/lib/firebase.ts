import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

const env = import.meta.env;

/** Có cấu hình Firebase (biến VITE_FIREBASE_*) thì dùng Firebase, không thì lưu cục bộ. */
export const coFirebase = !!env.VITE_FIREBASE_API_KEY;

let app: FirebaseApp | null = null;

export function firebase() {
  if (!coFirebase) return null;
  if (!app) {
    app = initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    });
    if (env.VITE_FIREBASE_EMULATOR) {
      connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(getFirestore(app), '127.0.0.1', 8080);
    }
  }
  return { auth: getAuth(app), db: getFirestore(app) };
}
