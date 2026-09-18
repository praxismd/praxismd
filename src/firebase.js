import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Fill these in with your own Firebase project's config — see .env.example.
// Create a .env.local file in the project root (never commit it) with the
// REACT_APP_FIREBASE_* values from your Firebase console, then restart
// `npm start` so Create React App picks them up.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// The Firebase SDK throws synchronously if apiKey/projectId are missing, which
// would crash the whole page before we ever get a chance to render a friendly
// message. Guard it so Auth.js can show a setup screen instead of a blank page.
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let auth = null;
let db = null;
let googleProvider = null;
let functions = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  functions = getFunctions(app);
}

export { auth, db, googleProvider, functions };
