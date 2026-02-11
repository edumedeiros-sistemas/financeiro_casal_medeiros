import { getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFunctions } from 'firebase/functions'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
}

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missingKeys.length > 0) {
  throw new Error(
    `Firebase não configurado. Verifique o arquivo .env (${missingKeys.join(
      ', ',
    )}).`,
  )
}

const app = initializeApp(firebaseConfig)
const secondaryApp =
  getApps().find((item) => item.name === 'secondary') ??
  initializeApp(firebaseConfig, 'secondary')

export const auth = getAuth(app)
export const secondaryAuth = getAuth(secondaryApp)
export const db = getFirestore(app)
export const secondaryDb = getFirestore(secondaryApp)
export const functions = getFunctions(app)
