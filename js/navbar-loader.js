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
      el.addEventListener("click", async () => {
        try {
          await updateDoc(doc(db, "notifications", el.dataset.id), { read: true });
        } catch (err) {
          console.error("Couldn't mark notification read:", err);
        }
        // Navigation happens via the normal <a href>, no preventDefault needed.
      });
    });
  }
}
