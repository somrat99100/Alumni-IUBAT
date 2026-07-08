// js/alumni.js
import { auth, app } from "./firebase-config.js";
// NOTE: this page uses the Firestore LITE SDK, not the full one. This page
// never uses onSnapshot — every read here is a one-time getDocs()/getDoc().
// But the FULL Firestore SDK still opens a persistent streaming connection
// (the "Listen/channel" WebChannel) internally for any operation, even a
// single one-shot read — that's just how its transport layer works, it's
// not limited to onSnapshot listeners. Googlebot's renderer can't sustain
// that connection, so the read for the alumni grid was never completing
// during Search Console's live test, leaving the page rendered empty and
// getting the indexing request rejected.
// Firestore Lite is a REST-only build (get/set/add/delete/query, no
// onSnapshot, no offline cache) built for exactly this: one-shot reads in
// environments — crawlers, SSR, low-connectivity — that can't hold a
// persistent stream open. Since this page never needs realtime updates,
// swapping just this page to Lite removes the Listen/channel call
// entirely, without touching firebase-config.js's full `db` export that
// navbar-loader.js/admin.js/profile.js still rely on for their live
// notification listeners.
import {
  getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-lite.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { toast, escapeHtml } from "./main.js";

const db = getFirestore(app);

const PURPOSES = [
  { id: "higher_study", label: "Higher Study Guidance", template: "Hi! I'm an IUBAT Agriculture student/alum looking for guidance on pursuing higher studies in your field. I'd love to hear about your experience and any advice you might have." },
  { id: "career_advice", label: "Career Advice", template: "Hi! I'm an IUBAT Agriculture student/alum and I'd really appreciate some career advice from someone with your experience. Would you be open to a short chat?" },
  { id: "internship", label: "Internship Opportunity", template: "Hi! I'm an IUBAT Agriculture student and I'm interested in internship opportunities in your area of work. I'd love to learn more if anything is available." },
  { id: "research", label: "Research Collaboration", template: "Hi! I'm reaching out about potential research collaboration — your work looks closely related to something I'm working on. Would you be open to connecting?" },
  { id: "job", label: "Job Opportunity", template: "Hi! I wanted to reach out regarding a job opportunity that might be a good fit. Would you be open to a conversation?" },
  { id: "other", label: "Other", template: "Hi! I'm a fellow IUBAT Agriculture student/alum and would love to connect. Looking forward to hearing from you!" }
];

const REJECT_COOLDOWN_DAYS = 30;

let currentUser = null;
let allAlumni = [];
let searchTerm = "";
let batchFilterValue = "";

// Used to auto-open a profile modal when arriving via a notification link
// like alumni.html?view=<uid> — we need both auth state resolved (so
// requestDoc/privateContact lookups work) and the directory loaded (so the
// alum's data is available) before opening.
let authResolved = false;
let alumniLoaded = false;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  authResolved = true;
  maybeOpenFromQuery();
});

function maybeOpenFromQuery() {
  if (!authResolved || !alumniLoaded) return;
  const params = new URLSearchParams(location.search);
  const viewUid = params.get("view");
  if (!viewUid) return;
  // Clean the URL immediately so a page refresh doesn't reopen the modal.
  history.replaceState(null, "", location.pathname);
  openProfileModal(viewUid);
}

async function loadAlumni() {
  const grid = document.getElementById("alumniGrid");
  try {
    const q = query(collection(db, "alumni"), where("status", "==", "approved"));
    const snap = await getDocs(q);
    allAlumni = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    allAlumni.sort((a, b) => (b.batch || "").localeCompare(a.batch || "") || (a.fullName || "").localeCompare(b.fullName || ""));
    populateBatchFilter();
    renderGrid(allAlumni);
    alumniLoaded = true;
    maybeOpenFromQuery();
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
      <img class="avatar" src="${escapeHtml(a.photoUrl || "https://placehold.co/96x96/E4EEDF/1F2E22?text=%F0%9F%8C%B1")}" alt="" onerror="this.onerror=null;this.src='https://placehold.co/96x96/E4EEDF/1F2E22?text=%F0%9F%8C%B1';" />
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

// Looks up any existing contact request between the current user and `toUid`.
// IMPORTANT: this uses a QUERY (not a direct doc-id get). A direct
// getDoc(doc(db,"contactRequests", `${uid}_${toUid}`)) throws
// "permission-denied" whenever that exact document doesn't exist yet,
// because Firestore rules can't evaluate `resource.data...` against a null
// resource — which was the cause of the profile modal getting stuck on
// "Loading profile…" forever for any signed-in user who hadn't already sent
// a request. A query with matching where() clauses just returns an empty
// result set instead, which Firestore can verify against the rules safely.
async function findExistingRequest(fromUid, toUid) {
  try {
    const q = query(
      collection(db, "contactRequests"),
      where("fromUid", "==", fromUid),
      where("toUid", "==", toUid)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  } catch (err) {
    console.error("Couldn't check contact request status:", err);
    return null;
  }
}

// Fetches the private contact subcollection doc, if the caller is allowed to
// (owner, admin, or an approved requester per the Firestore rules). Never
// throws — a permission error here just means "not unlocked."
async function fetchPrivateContact(uid) {
  try {
    const snap = await getDoc(doc(db, "alumni", uid, "private", "contact"));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    return null;
  }
}

async function openProfileModal(uid) {
  const overlay = document.getElementById("profileModalOverlay");
  const modal = document.getElementById("profileModal");
  modal.innerHTML = `<p class="muted"><span class="spinner"></span> Loading profile…</p>`;
  overlay.hidden = false;

  const alum = allAlumni.find((a) => a.uid === uid);
  if (!alum) { modal.innerHTML = "<p>Profile not found.</p>"; return; }

  let requestDoc = null;
  let privateContact = null;

  try {
    if (currentUser) {
      requestDoc = await findExistingRequest(currentUser.uid, uid);
      const isOwner = currentUser.uid === uid;
      const isApprovedRequester = requestDoc && requestDoc.status === "approved";
      if (isOwner || isApprovedRequester) {
        privateContact = await fetchPrivateContact(uid);
      }
    }
  } catch (err) {
    console.error(err);
    // Don't let a contact-lookup failure block the whole profile from rendering.
  }

  modal.innerHTML = `
    <button class="modal-close" id="closeProfileModal">✕</button>
    <div class="row gap-16">
      <img class="avatar" style="width:64px;height:64px;" src="${escapeHtml(alum.photoUrl || "https://placehold.co/64x64/E4EEDF/1F2E22?text=%F0%9F%8C%B1")}" alt="" onerror="this.onerror=null;this.src='https://placehold.co/64x64/E4EEDF/1F2E22?text=%F0%9F%8C%B1';" />
      <div>
        <h3 class="mb-0">${escapeHtml(alum.fullName || "Unnamed")}</h3>
        <div class="meta muted">Batch ${escapeHtml(alum.batch || "—")}</div>
      </div>
    </div>
    ${alum.jobTitle ? `<p class="mt-16"><strong>${escapeHtml(alum.jobTitle)}</strong>${alum.org ? " at " + escapeHtml(alum.org) : ""}</p>` : ""}
    ${alum.researchArea ? `<p class="muted">Research area: ${escapeHtml(alum.researchArea)}</p>` : ""}
    ${renderJobHistory(alum.jobHistory)}
    <h3 class="mt-24">Contact</h3>
    <div id="contactSection">${renderContactSection(alum, requestDoc, privateContact)}</div>
  `;

  document.getElementById("closeProfileModal").addEventListener("click", () => overlay.hidden = true);

  const requestBtn = modal.querySelector("#requestContactBtn");
  if (requestBtn) requestBtn.addEventListener("click", () => openRequestModal(alum, requestDoc));
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

function lockedRow(label) {
  return `
    <div class="contact-row">
      <span class="label">${label}</span>
      <span class="value locked-value">🔒 Private</span>
    </div>`;
}

function contactRow(label, value, href) {
  const inner = href
    ? `<a href="${escapeHtml(href)}">${escapeHtml(value)}</a>`
    : escapeHtml(value);
  return `
    <div class="contact-row">
      <span class="label">${label}</span>
      <span class="value">${inner}</span>
    </div>`;
}

// Facebook / LinkedIn: always-public professional links, rendered as a
// button (the URL itself is never shown as text — it's embedded in the
// button's href). If the alum didn't provide one, shows "Not provided"
// instead of hiding the row.
function socialRow(label, url, cls, emoji) {
  if (url) {
    return `
      <div class="contact-row">
        <span class="label">${label}</span>
        <a class="social-btn ${cls}" href="${escapeHtml(url)}" target="_blank" rel="noopener">${emoji} ${label}</a>
      </div>`;
  }
  return `
    <div class="contact-row">
      <span class="label">${label}</span>
      <span class="value muted">Not provided</span>
    </div>`;
}

function whatsappRow(number) {
  const digits = number.replace(/[^\d+]/g, "");
  return `
    <div class="contact-row">
      <span class="label">WhatsApp</span>
      <a class="social-btn social-btn-wa" href="https://wa.me/${digits.replace("+", "")}" target="_blank" rel="noopener">💬 Message on WhatsApp</a>
    </div>`;
}

function renderContactSection(alum, requestDoc, privateContact) {
  const vis = alum.visibility || {};
  const rows = [];

  // "Unlocked" means this viewer is allowed to read private/contact per the
  // Firestore rules — either it's their own profile, or they have an
  // approved contact request. Governs the Phone/WhatsApp fallback below.
  const isOwnProfile = currentUser && currentUser.uid === alum.uid;
  const isApprovedRequester = requestDoc && requestDoc.status === "approved";
  const unlocked = isOwnProfile || isApprovedRequester;

  // Facebook / LinkedIn: always public, shown first in the Contact list.
  rows.push(socialRow("Facebook", alum.facebookUrl, "social-btn-fb", "📘"));
  rows.push(socialRow("LinkedIn", alum.linkedinUrl, "social-btn-li", "💼"));

  // Phone: unlocked directly if the alum made it public. Otherwise, if the
  // viewer has an approved request (or it's their own profile), fall back
  // to the private phone. Still locked for everyone else.
  if (vis.phone === "public" && alum.publicPhone) {
    rows.push(contactRow("Phone", alum.publicPhone, `tel:${alum.publicPhone}`));
  } else if (unlocked && privateContact?.phone) {
    rows.push(contactRow("Phone", privateContact.phone, `tel:${privateContact.phone}`));
  } else {
    rows.push(lockedRow("Phone"));
  }

  // WhatsApp: same pattern — public first, then approved/own-profile
  // fallback to the private number, otherwise locked.
  if (vis.whatsapp === "public" && alum.publicWhatsapp) {
    rows.push(whatsappRow(alum.publicWhatsapp));
  } else if (unlocked && privateContact?.whatsapp) {
    rows.push(whatsappRow(privateContact.whatsapp));
  } else {
    rows.push(lockedRow("WhatsApp"));
  }

  if (!currentUser) {
    rows.push(lockedRow("Email"));
    rows.push(`<p class="muted mt-16">Email is private. <a href="login.html">Log in</a> to request contact.</p>`);
    return rows.join("");
  }

  if (isOwnProfile) {
    if (privateContact?.email) {
      rows.push(contactRow("Email", privateContact.email, `mailto:${privateContact.email}`));
    } else {
      rows.push(lockedRow("Email"));
    }
    rows.push(`<p class="muted mt-16">This is your own profile. Edit it from <a href="my-profile.html">My Profile</a>.</p>`);
    return rows.join("");
  }

  if (!requestDoc) {
    rows.push(lockedRow("Email"));
    rows.push(`<p class="mt-16"><button class="btn btn-accent btn-sm" id="requestContactBtn">Request Contact</button></p>`);
    return rows.join("");
  }

  if (requestDoc.status === "pending") {
    rows.push(lockedRow("Email"));
    rows.push(`<p class="mt-16"><span class="badge badge-pending">Request pending</span></p>`);
    return rows.join("");
  }

  if (requestDoc.status === "approved") {
    if (privateContact?.email) {
      rows.push(contactRow("Email", privateContact.email, `mailto:${privateContact.email}`));
    } else {
      rows.push(lockedRow("Email"));
    }
    return rows.join("");
  }

  if (requestDoc.status === "rejected") {
    rows.push(lockedRow("Email"));
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

// Creates an in-app notification for the alum who just received a new
// contact request, so they see it via the navbar bell without needing to
// manually check my-profile.html. Mirrors notifyApproval() in profile.js.
async function notifyNewRequest(toUid, reqId) {
  try {
    let senderName = currentUser.displayName || "A fellow alum";
    try {
      const senderSnap = await getDoc(doc(db, "alumni", currentUser.uid));
      if (senderSnap.exists() && senderSnap.data().fullName) {
        senderName = senderSnap.data().fullName;
      }
    } catch (_) {
      // Fall back to the default name above if this lookup fails.
    }

    await addDoc(collection(db, "notifications"), {
      toUid,
      type: "contact_request_received",
      aboutUid: currentUser.uid,
      aboutName: senderName,
      requestId: reqId,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Couldn't create new-request notification:", err);
  }
}

function openRequestModal(alum, priorRequestDoc) {
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
        <textarea id="requestMessage" required></textarea>
        <p class="hint">A starting message is filled in for you — feel free to just edit it and send, or write your own.</p>
      </div>
      <button type="submit" class="btn btn-accent btn-block" id="sendRequestBtn">Send Request</button>
    </form>
  `;
  overlay.hidden = false;

  const messageBox = document.getElementById("requestMessage");
  const setTemplateFor = (purposeId) => {
    const p = PURPOSES.find((x) => x.id === purposeId) || PURPOSES[PURPOSES.length - 1];
    messageBox.value = p.template;
  };
  setTemplateFor(PURPOSES[0].id);

  modal.querySelectorAll('input[name="purpose"]').forEach((radio) => {
    radio.addEventListener("change", (e) => setTemplateFor(e.target.value));
  });

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

      // Re-requesting after a rejection: the old doc must be deleted first
      // (the security rules only allow the requester to delete it once
      // rejected + the 30-day cooldown has passed). This turns the setDoc
      // below into a genuine "create" instead of an "update" — which is
      // what the rules require, since fromUid is never allowed to update
      // an existing request (that's what stops self-approval).
      if (priorRequestDoc && priorRequestDoc.status === "rejected") {
        await deleteDoc(doc(db, "contactRequests", reqId));
      }

      await setDoc(doc(db, "contactRequests", reqId), {
        fromUid: currentUser.uid,
        toUid: alum.uid,
        purpose,
        message,
        status: "pending",
        createdAt: serverTimestamp()
      });

      // Best-effort: never let a notification hiccup undo or block the
      // request that already succeeded above.
      notifyNewRequest(alum.uid, reqId);

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