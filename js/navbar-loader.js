// js/navbar-loader.js
// Injects the shared navbar into <div id="navbar-root"></div> on every page,
// and swaps Login <-> My Profile / Logout based on auth state.

import { auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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

  onAuthStateChanged(auth, (user) => {
    if (user) {
      authArea.innerHTML = `
        <a href="my-profile.html" class="btn btn-outline btn-sm">My Profile</a>
        <button class="btn btn-primary btn-sm" id="navLogoutBtn">Log out</button>
      `;
      document.getElementById("navLogoutBtn").addEventListener("click", async () => {
        await signOut(auth);
        location.href = "index.html";
      });
    } else {
      authArea.innerHTML = `<a href="login.html" class="btn btn-outline btn-sm">Log in</a>`;
    }
  });
}
