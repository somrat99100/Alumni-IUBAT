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

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBA7ZKs9FZ5qROMHucFtboPjkFX-00G9oE",
  authDomain: "iubat-agri-alumni.firebaseapp.com",
  projectId: "iubat-agri-alumni",
  storageBucket: "iubat-agri-alumni.firebasestorage.app",
  messagingSenderId: "304941777666",
  appId: "1:304941777666:web:b5697d9826159e231eb81b",
  measurementId: "G-LL3ZM6P8FR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Exported so pages that don't need realtime listeners (e.g. alumni.js) can
// spin up a Firestore Lite instance against the same app instead — see the
// comment in alumni.js for why that matters for Googlebot indexing.
export { app };