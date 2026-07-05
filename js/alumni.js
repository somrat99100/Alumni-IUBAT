// js/alumni.js
import { auth, db } from "./firebase-config.js";
import {
  collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { toast, escapeHtml } from "./main.js";

const PURPOSES = [
  { id: "higher_study", label: "Higher Study Guidance" },
  { id: "career_advice", label: "Career Advice" },
  { id: "internship", label: "Internship Opportunity" },
  { id: "research", label: "Research Collaboration" },
  { id: "job", label: "Job Opportunity" },
  { id: "other", label: "Other" }
];

const REJECT_COOLDOWN_DAYS = 30;

let currentUser = null;
let allAlumni = [];
let searchTerm = "";
let batchFilterValue = "";

onAuthStateChanged(auth, (user) => { currentUser = user; });

async function loadAlumni() {
  const grid = document.getElementById("alumniGrid");
  try {
    const q = query(collection(db, "alumni"), where("status", "==", "approved"));
    const snap = await getDocs(q);
    allAlumni = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    allAlumni.sort((a, b) => (b.batch || "").localeCompare(a.batch || "") || (a.fullName || "").localeCompare(b.fullName || ""));
    populateBatchFilter();
    renderGrid(allAlumni);
  } catch (err) {
    grid.innerHTML = `<p class="muted">Couldn't load the directory right now. Please refresh.</p>`;
    console.error(err);
  }
}

function populateBatchFilter() {
  const select = document.getElementById("batchFilter");
  const batches = [...new Set(allAlumni.map((a) => a.batch).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  select.innerHTML = `<option value="">All batches</option>` +
    batches.map((b) => `<option value="${escapeHtml(b)}">Batch ${escapeHtml(b)}</option>`).join("");
}

function applyFilters() {
  const term = searchTerm.trim().toLowerCase();
  const filtered = allAlumni.filter((a) => {
    const matchesTerm = !term ||
      (a.fullName || "").toLowerCase().includes(term) ||
      (a.batch || "").toLowerCase().includes(term) ||
      (a.jobTitle || "").toLowerCase().includes(term) ||
      (a.org || "").toLowerCase().includes(term);
    const matchesBatch = !batchFilterValue || a.batch === batchFilterValue;
    return matchesTerm && matchesBatch;
  });
  renderGrid(filtered);
}

function renderGrid(list) {
  const grid = document.getElementById("alumniGrid");
  const empty = document.getElementById("emptyState");
  const count = document.getElementById("resultCount");
  count.textContent = `${list.length} alumni ${list.length === 1 ? "profile" : "profiles"} found`;

  if (list.length === 0) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.innerHTML = list.map((a) => `
    <div class="alumni-card" data-uid="${a.uid}">
      <img class="avatar" src="${a.photoUrl || "https://placehold.co/96x96/E4EEDF/1F2E22?text=%F0%9F%8C%B1"}" alt="" onerror="this.onerror=null;this.src='https://placehold.co/96x96/E4EEDF/1F2E22?text=%F0%9F%8C%B1';" />
      ${a.batch ? `<span class="batch-badge">Batch ${escapeHtml(a.batch)}</span>` : ""}
      <h3>${escapeHtml(a.fullName || "Unnamed")}</h3>
      ${a.jobTitle ? `<div class="job">${escapeHtml(a.jobTitle)}${a.org ? " · " + escapeHtml(a.org) : ""}</div>` : `<div class="meta">Agriculture Alumni</div>`}
      <div class="view-hint">View profile →</div>
    </div>
  `).join("");

  grid.querySelectorAll(".alumni-card").forEach((card) => {
    card.addEventListener("click", () => openProfileModal(card.dataset.uid));
  });
}

document.getElementById("searchInput").addEventListener("input", (e) => {
  searchTerm = e.target.value;
  applyFilters();
});
document.getElementById("batchFilter").addEventListener("change", (e) => {
  batchFilterValue = e.target.value;
  applyFilters();
});

async function openProfileModal(uid) {
  const overlay = document.getElementById("profileModalOverlay");
  const modal = document.getElementById("profileModal");
  modal.innerHTML = `<p class="muted"><span class="spinner"></span> Loading profile…</p>`;
  overlay.hidden = false;

  const alum = allAlumni.find((a) => a.uid === uid);
  if (!alum) { modal.innerHTML = "<p>Profile not found.</p>"; return; }

  let requestDoc = null;
  if (currentUser) {
    const reqId = `${currentUser.uid}_${uid}`;
    const snap = await getDoc(doc(db, "contactRequests", reqId));
    if (snap.exists()) requestDoc = { id: reqId, ...snap.data() };
  }

  modal.innerHTML = `
    <button class="modal-close" id="closeProfileModal">✕</button>
    <div class="row gap-16">
      <img class="avatar" style="width:64px;height:64px;" src="${alum.photoUrl || "https://placehold.co/64x64/E4EEDF/1F2E22?text=%F0%9F%8C%B1"}" alt="" onerror="this.onerror=null;this.src='https://placehold.co/64x64/E4EEDF/1F2E22?text=%F0%9F%8C%B1';" />
      <div>
        <h3 class="mb-0">${escapeHtml(alum.fullName || "Unnamed")}</h3>
        <div class="meta muted">Batch ${escapeHtml(alum.batch || "—")}</div>
      </div>
    </div>
    ${alum.jobTitle ? `<p class="mt-16"><strong>${escapeHtml(alum.jobTitle)}</strong>${alum.org ? " at " + escapeHtml(alum.org) : ""}</p>` : ""}
    ${alum.researchArea ? `<p class="muted">Research area: ${escapeHtml(alum.researchArea)}</p>` : ""}
    ${renderJobHistory(alum.jobHistory)}
    <h3 class="mt-24">Contact</h3>
    <div id="contactSection">${renderContactSection(alum, requestDoc)}</div>
  `;

  document.getElementById("closeProfileModal").addEventListener("click", () => overlay.hidden = true);

  const requestBtn = modal.querySelector("#requestContactBtn");
  if (requestBtn) requestBtn.addEventListener("click", () => openRequestModal(alum));
}

function renderJobHistory(history) {
  if (!history || history.length === 0) return "";
  const rows = history.map((j) => `
    <div class="contact-row">
      <div>
        <strong>${escapeHtml(j.title || "")}</strong> ${j.org ? "· " + escapeHtml(j.org) : ""}
        <div class="muted" style="font-size:0.8rem;">${escapeHtml(j.startDate || "")} – ${escapeHtml(j.endDate || "Present")}</div>
      </div>
    </div>
  `).join("");
  return `<h3 class="mt-24">Job History</h3>${rows}`;
}

function renderContactSection(alum, requestDoc) {
  const vis = alum.visibility || {};
  const rows = [];

  // Public phone / whatsapp show directly
  if (vis.phone === "public") {
    rows.push(contactRow("Phone", alum.publicPhone || "Available", true));
  }
  if (vis.whatsapp === "public") {
    rows.push(contactRow("WhatsApp", alum.publicWhatsapp || "Available", true));
  }

  if (!currentUser) {
    rows.push(`<p class="muted mt-16">Email, Facebook and LinkedIn are private. <a href="login.html">Log in</a> to request contact.</p>`);
    return rows.join("");
  }

  if (currentUser.uid === alum.uid) {
    rows.push(`<p class="muted mt-16">This is your own profile. Edit it from <a href="my-profile.html">My Profile</a>.</p>`);
    return rows.join("");
  }

  if (!requestDoc) {
    rows.push(`<p class="mt-16"><button class="btn btn-accent btn-sm" id="requestContactBtn">Request Contact</button></p>`);
    return rows.join("");
  }

  if (requestDoc.status === "pending") {
    rows.push(`<p class="mt-16"><span class="badge badge-pending">Request pending</span></p>`);
    return rows.join("");
  }

  if (requestDoc.status === "approved") {
    rows.push(contactRow("Email", alum.contactUnlocked?.email || "Unlocked — see below", true));
    rows.push(`<p class="hint">Full contact details are shared once you and the alum connect off-platform via the approved request.</p>`);
    return rows.join("");
  }

  if (requestDoc.status === "rejected") {
    const decidedAt = requestDoc.decidedAt?.toDate ? requestDoc.decidedAt.toDate() : new Date();
    const daysLeft = REJECT_COOLDOWN_DAYS - Math.floor((Date.now() - decidedAt.getTime()) / 86400000);
    if (daysLeft > 0) {
      rows.push(`<p class="mt-16 muted">Request declined. You can request again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.</p>`);
    } else {
      rows.push(`<p class="mt-16"><button class="btn btn-accent btn-sm" id="requestContactBtn">Request Contact</button></p>`);
    }
    return rows.join("");
  }

  return rows.join("");
}

function contactRow(label, value, unlocked) {
  return `
    <div class="contact-row">
      <span class="label">${label}</span>
      <span class="value ${unlocked ? "" : "locked-value"}">${escapeHtml(value)}</span>
    </div>`;
}

function openRequestModal(alum) {
  const overlay = document.getElementById("requestModalOverlay");
  const modal = document.getElementById("requestModal");
  modal.innerHTML = `
    <button class="modal-close" id="closeRequestModal">✕</button>
    <h3>Request contact with ${escapeHtml(alum.fullName || "this alum")}</h3>
    <form id="requestForm">
      <div class="field">
        <label>Purpose</label>
        <div class="radio-group">
          ${PURPOSES.map((p, i) => `
            <label class="radio-option">
              <input type="radio" name="purpose" value="${p.id}" ${i === 0 ? "checked" : ""} />
              <span>${p.label}</span>
            </label>`).join("")}
        </div>
      </div>
      <div class="field">
        <label for="requestMessage">Message</label>
        <textarea id="requestMessage" placeholder="Introduce yourself and say why you'd like to connect…" required></textarea>
      </div>
      <button type="submit" class="btn btn-accent btn-block" id="sendRequestBtn">Send Request</button>
    </form>
  `;
  overlay.hidden = false;
  document.getElementById("closeRequestModal").addEventListener("click", () => overlay.hidden = true);

  document.getElementById("requestForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("sendRequestBtn");
    btn.disabled = true;
    btn.textContent = "Sending…";
    try {
      const purpose = document.querySelector('input[name="purpose"]:checked').value;
      const message = document.getElementById("requestMessage").value.trim();
      const reqId = `${currentUser.uid}_${alum.uid}`;
      await setDoc(doc(db, "contactRequests", reqId), {
        fromUid: currentUser.uid,
        toUid: alum.uid,
        purpose,
        message,
        status: "pending",
        createdAt: serverTimestamp()
      });
      toast("Request sent.", "success");
      overlay.hidden = true;
      document.getElementById("profileModalOverlay").hidden = true;
    } catch (err) {
      toast("Couldn't send the request. Please try again.", "error");
      console.error(err);
      btn.disabled = false;
      btn.textContent = "Send Request";
    }
  });
}

loadAlumni();

// Close modals on backdrop click or Escape key
["profileModalOverlay", "requestModalOverlay"].forEach((id) => {
  const overlay = document.getElementById(id);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.hidden = true;
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.getElementById("profileModalOverlay").hidden = true;
    document.getElementById("requestModalOverlay").hidden = true;
  }
});
