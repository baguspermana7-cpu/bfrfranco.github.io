/**
 * Firebase project configuration (public keys).
 * These are safe to expose in client-side code.
 * Replace placeholders with your Firebase project values from:
 *   Firebase Console → Project Settings → General → Your apps → Web app
 */
const FIREBASE_CONFIG = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

/**
 * API base URL for the Cloud Run backend.
 * Change to localhost for local development.
 */
const API_BASE = 'https://bfrfranco-github-io-586770625232.us-central1.run.app';
// const API_BASE = 'http://localhost:8080'; // Local dev
