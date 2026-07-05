// js/firebase-config.js
// Central Firebase init — imported by every page that needs auth/db.
// The apiKey below is NOT a secret; real protection comes from the
// Firestore security rules (see setup-guide.md), not from hiding this file.
//
// NOTE: Firebase Storage is intentionally NOT used here. As of Feb 3, 2026,
// Firebase requires the paid Blaze plan (card on file) to use Cloud Storage.
// Auth + Firestore stay fully free on the Spark plan, and photo uploads are
// handled by Cloudinary instead (free, no card required) — see cloudinary.js.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
