// js/firebase-config.js
// Central Firebase init — imported by every page that needs auth/db/storage.
// The apiKey below is NOT a secret; real protection comes from the
// Firestore/Storage security rules (see setup-guide.md), not from hiding this file.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "PASTE_FROM_FIREBASE_CONSOLE",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
