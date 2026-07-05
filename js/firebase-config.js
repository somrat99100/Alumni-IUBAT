// js/firebase-config.js
// Central Firebase init — imported by every page that needs auth/db/storage.
// The apiKey below is NOT a secret; real protection comes from the
// Firestore/Storage security rules (see setup-guide.md), not from hiding this file.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

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
export const storage = getStorage(app);
