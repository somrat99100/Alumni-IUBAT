// js/navbar-loader.js
// Injects the shared navbar into <div id="navbar-root"></div> on every page,
// swaps Login <-> My Profile / Logout based on auth state, and shows a live
// notification bell (contact-request approvals) when signed in.

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, query, where, orderBy, onSnapshot, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { escapeHtml } from "./main.js";

const NAV_HTML = `
<nav class="navbar">
  <div class="navbar-inner">
    <a href="index.html" class="nav-brand">
      <img src="https://res.cloudinary.com/db6r0up6r/image/upload/w_68,h_68,c_fill,q_auto,f_auto/v1783437577/logo_qpv3nd.jpg" alt="IUBAT Agriculture Alumni" class="mark" />
      IUBAT Agri Alumni
    </a>
    <button class="nav-toggle" aria-label="Toggle menu" id="navToggle">☰</button>
    <div class="nav-links" id="navLinks">
      <a href="index.html">Home</a>
      <a href="department.html">Department</a>
      <a href="alumni.html">Explore Alumni</a>
      <a href="register.html" id="navRegisterLink">Register as Alumni</a>
      <div class="nav-actions" id="navAuthArea">
        <a href="login.html" class="btn btn-outline btn-sm" id="navLoginBtn">Log in</a>
      </div>
    </div>
  </div>
</nav>`;

// ── Floating WhatsApp help button ──────────────────────────────────────
// Shown on every page (any page that loads this script), bottom-right
// corner. Opens a WhatsApp chat with Mizan (batch 242), the alumni
// network's contact, with a short pre-filled message so people don't land
// on a blank chat. Update WHATSAPP_NUMBER below if the number ever changes
// (digits only, no "+", spaces, or leading zeros after the country code).
const WHATSAPP_NUMBER = "8801753486065";
const WHATSAPP_MESSAGE = "Hi, I need help with the IUBAT Alumni Network.";

function injectWhatsAppButton() {
  if (document.getElementById("whatsappFloatBtn")) return; // avoid double-injecting
  const a = document.createElement("a");
  a.id = "whatsappFloatBtn";
  a.className = "whatsapp-float";
  a.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.title = "Ask for any help — Mizan, Batch 242";
  a.setAttribute("aria-label", "Chat with Mizan (Batch 242) on WhatsApp for help");
  a.innerHTML = `
    <svg viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.001 2.667c-7.363 0-13.334 5.97-13.334 13.333 0 2.352.615 4.66 1.784 6.687L2.667 29.333l6.79-1.78a13.28 13.28 0 0 0 6.544 1.714h.006c7.362 0 13.333-5.97 13.333-13.333 0-3.562-1.387-6.912-3.905-9.43a13.24 13.24 0 0 0-9.434-3.837zm0 24.4h-.005a11.05 11.05 0 0 1-5.633-1.542l-.404-.24-4.03 1.057 1.076-3.928-.263-.403a11.03 11.03 0 0 1-1.69-5.878c0-6.11 4.972-11.083 11.084-11.083 2.961 0 5.744 1.153 7.837 3.248a11.006 11.006 0 0 1 3.244 7.84c0 6.111-4.972 11.083-11.216 11.083v-.154zm6.077-8.297c-.333-.167-1.966-.97-2.271-1.08-.305-.111-.527-.167-.749.167s-.86 1.08-1.054 1.302-.389.25-.722.083-1.407-.518-2.68-1.653c-.99-.883-1.66-1.974-1.854-2.307s-.021-.514.146-.68c.15-.15.333-.389.5-.583.166-.194.222-.333.333-.556.111-.222.056-.417-.028-.583-.084-.167-.75-1.807-1.028-2.474-.27-.65-.545-.563-.75-.573-.194-.008-.417-.01-.639-.01s-.583.083-.889.417c-.305.333-1.166 1.14-1.166 2.78s1.194 3.226 1.36 3.448c.167.222 2.348 3.583 5.687 5.024.794.343 1.415.548 1.898.702.797.254 1.523.218 2.096.132.639-.096 1.966-.803 2.243-1.58.278-.777.278-1.442.194-1.58-.083-.14-.305-.222-.638-.389z"/>
    </svg>`;
  document.body.appendChild(a);
}
injectWhatsAppButton();

const root = document.getElementById("navbar-root");
if (root) {
  root.innerHTML = NAV_HTML;

  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  toggle.addEventListener("click", () => links.classList.toggle("mobile-open"));

  const authArea = document.getElementById("navAuthArea");
  let unsubscribeNotifications = null;

  onAuthStateChanged(auth, (user) => {
    if (unsubscribeNotifications) {
      unsubscribeNotifications();
      unsubscribeNotifications = null;
    }

    if (user) {
      authArea.innerHTML = `
        <div class="notif-wrap">
          <button class="notif-bell" id="notifBellBtn" aria-label="Notifications">
            🔔<span class="notif-dot" id="notifDot" hidden></span>
          </button>
          <div class="notif-panel" id="notifPanel" hidden>
            <p class="notif-panel-title">Notifications</p>
            <div id="notifList"><p class="muted notif-empty">Loading…</p></div>
          </div>
        </div>
        <a href="my-profile.html" class="btn btn-outline btn-sm">My Profile</a>
        <button class="btn btn-primary btn-sm" id="navLogoutBtn">Log out</button>
      `;
      document.getElementById("navLogoutBtn").addEventListener("click", async () => {
        await signOut(auth);
        location.href = "index.html";
      });

      const bellBtn = document.getElementById("notifBellBtn");
      const panel = document.getElementById("notifPanel");
      bellBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        panel.hidden = !panel.hidden;
      });
      document.addEventListener("click", (e) => {
        if (!panel.hidden && !panel.contains(e.target) && e.target !== bellBtn) {
          panel.hidden = true;
        }
      });

      // Live-updates whenever a new approval notification arrives, no
      // refresh needed. Ordered newest first, capped implicitly by only
      // showing what's unread + a short recent-read tail (kept simple:
      // just show everything the query returns, most recent 20).
      const q = query(
        collection(db, "notifications"),
        where("toUid", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      unsubscribeNotifications = onSnapshot(q, (snap) => {
        console.log(`[notifications] received ${snap.docs.length} doc(s) for uid=${user.uid}`);
        renderNotifications(snap.docs.slice(0, 20));
      }, (err) => {
        console.error("Notification listener failed:", err);
        const list = document.getElementById("notifList");
        if (list) {
          list.innerHTML = `<p class="muted notif-empty">Couldn't load notifications (${escapeHtml(err.code || "error")}). Check console.</p>`;
        }
      });
    } else {
      authArea.innerHTML = `<a href="login.html" class="btn btn-outline btn-sm">Log in</a>`;
    }
  });

  function renderNotifications(docs) {
    const dot = document.getElementById("notifDot");
    const list = document.getElementById("notifList");
    if (!dot || !list) return;

    const unreadCount = docs.filter((d) => !d.data().read).length;
    dot.hidden = unreadCount === 0;
    dot.textContent = unreadCount > 9 ? "9+" : (unreadCount || "");

    if (docs.length === 0) {
      list.innerHTML = `<p class="muted notif-empty">No notifications yet.</p>`;
      return;
    }

    list.innerHTML = docs.map((d) => {
      const n = d.data();
      const name = escapeHtml(n.aboutName || "An alum");

      if (n.type === "contact_approved") {
        return `
          <a class="notif-item ${n.read ? "" : "notif-unread"}" href="alumni.html?view=${encodeURIComponent(n.aboutUid)}" data-id="${d.id}">
            <span class="notif-icon">✅</span>
            <span>
              <strong>${name}</strong> accepted your contact request.
              <span class="notif-view">View now →</span>
            </span>
          </a>`;
      }

      if (n.type === "contact_request_received") {
        return `
          <a class="notif-item ${n.read ? "" : "notif-unread"}" href="my-profile.html" data-id="${d.id}">
            <span class="notif-icon">📩</span>
            <span>
              <strong>${name}</strong> sent you a contact request.
              <span class="notif-view">Review it →</span>
            </span>
          </a>`;
      }

      return "";
    }).join("");

    list.querySelectorAll(".notif-item").forEach((el) => {
      el.addEventListener("click", async (e) => {
        // Navigating via the raw <a href> immediately unloads this page,
        // which can cancel the updateDoc network request before Firestore
        // acknowledges it — leaving the notification permanently "unread"
        // even though the user already viewed it. So: stop the default
        // navigation, wait for the read-update to actually complete, then
        // navigate ourselves.
        e.preventDefault();
        const destination = el.getAttribute("href");
        try {
          await updateDoc(doc(db, "notifications", el.dataset.id), { read: true });
        } catch (err) {
          console.error("Couldn't mark notification read:", err);
        }
        location.href = destination;
      });
    });
  }
}
