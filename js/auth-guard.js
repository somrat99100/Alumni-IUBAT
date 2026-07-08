// js/auth-guard.js
// Put data-auth="required" or data-auth="admin" on <body> for protected pages.
// This only controls what renders in the browser — the real enforcement
// always lives in the Firestore/Storage security rules (a visitor can edit
// this file's logic in devtools, but cannot edit rules running on Firebase's servers).

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const level = document.body.dataset.auth; // "required" | "admin" | undefined

let resolveUser;
const userReady = new Promise((res) => { resolveUser = res; });

// Exposed so pages can do: const user = await window.requireAuth();
window.requireAuth = () => userReady;

onAuthStateChanged(auth, async (user) => {
  if (level === "required" || level === "admin") {
    if (!user) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = `login.html?next=${next}`;
      return;
    }
    if (level === "admin") {
      console.log("[auth-guard] Checking admin for UID:", user.uid);
      try {
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        console.log("[auth-guard] admins doc exists:", adminDoc.exists(), adminDoc.data());
        if (!adminDoc.exists()) {
          console.log("[auth-guard] No admin doc found — redirecting to index.html");
          location.href = "index.html";
          return;
        }
      } catch (err) {
        console.error("[auth-guard] Error reading admin doc:", err);
        location.href = "index.html";
        return;
      }
    }
  }
  document.body.classList.add("auth-ready");
  resolveUser(user || null);
});
