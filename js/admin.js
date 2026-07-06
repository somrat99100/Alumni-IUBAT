// js/admin.js
import { db } from "./firebase-config.js";
import {
  collection, query, where, getDocs, doc, updateDoc, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { toast, escapeHtml } from "./main.js";

let activeStatus = "pending";

async function loadQueue(status) {
  const list = document.getElementById("queueList");
  list.innerHTML = `<p class="muted"><span class="spinner"></span> Loading…</p>`;
  try {
    const q = query(collection(db, "alumni"), where("status", "==", status));
    const snap = await getDocs(q);
    if (snap.empty) {
      list.innerHTML = `<p class="muted">Nothing here.</p>`;
      return;
    }
    list.innerHTML = snap.docs.map((d) => {
      const a = d.data();
      return `
        <div class="card mt-16">
          <div class="row" style="justify-content:space-between; align-items:flex-start;">
            <div class="row gap-16">
              <img class="avatar" style="width:56px;height:56px;" src="${a.photoUrl || "https://placehold.co/56x56/E4EEDF/1F2E22?text=%F0%9F%8C%B1"}" alt="" onerror="this.onerror=null;this.src='https://placehold.co/56x56/E4EEDF/1F2E22?text=%F0%9F%8C%B1';" />
              <div>
                <h3 class="mb-0">${escapeHtml(a.fullName || "Unnamed")}</h3>
                <div class="muted">Batch ${escapeHtml(a.batch || "—")} · Student ID ${escapeHtml(a.studentId || "—")}</div>
              </div>
            </div>
            <span class="badge badge-${status}">${status}</span>
          </div>
          ${a.jobTitle ? `<p class="mt-16">${escapeHtml(a.jobTitle)}${a.org ? " at " + escapeHtml(a.org) : ""}</p>` : ""}
          <div class="row gap-12 mt-16">
            ${status === "pending" ? `
              <button class="btn btn-primary btn-sm approve-btn" data-uid="${d.id}">Approve</button>
              <button class="btn btn-danger btn-sm reject-btn" data-uid="${d.id}">Reject</button>
            ` : ""}
            <button class="btn btn-outline btn-sm delete-btn" data-uid="${d.id}" data-name="${escapeHtml(a.fullName || "this profile")}">Delete</button>
          </div>
        </div>`;
    }).join("");

    list.querySelectorAll(".approve-btn").forEach((btn) => {
      btn.addEventListener("click", () => decide(btn.dataset.uid, "approved"));
    });
    list.querySelectorAll(".reject-btn").forEach((btn) => {
      btn.addEventListener("click", () => decide(btn.dataset.uid, "rejected"));
    });
    list.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => confirmDelete(btn.dataset.uid, btn.dataset.name));
    });
  } catch (err) {
    list.innerHTML = `<p class="muted">Couldn't load the queue.</p>`;
    console.error(err);
  }
}

async function decide(uid, status) {
  try {
    const updates = { status, updatedAt: new Date() };
    if (status === "approved") updates.everApproved = true;
    await updateDoc(doc(db, "alumni", uid), updates);
    toast(`Marked as ${status}.`, "success");

    // Best-effort: never let an email hiccup undo or block the approval
    // that already succeeded in Firestore.
    if (status === "approved") notifyApproval(uid);

    loadQueue(activeStatus);
  } catch (err) {
    toast("Couldn't update this profile. Check that your admin doc exists.", "error");
    console.error(err);
  }
}

// ── Approval email notification (EmailJS) ──────────────────────────────
// SETUP REQUIRED: replace these three placeholders with your own EmailJS
// values (dashboard → Email Services / Email Templates / Account → API
// Keys). The template just needs to expect {{to_email}} and {{to_name}}
// variables. The public key is set via emailjs.init(...) in admin.html.
const EMAILJS_SERVICE_ID = "service_axm0jjz";
const EMAILJS_TEMPLATE_ID = "template_bumd2ed";

async function notifyApproval(uid) {
  try {
    if (typeof emailjs === "undefined") {
      console.warn("EmailJS SDK not loaded — skipping approval email.");
      return;
    }
    const [publicSnap, privateSnap] = await Promise.all([
      getDoc(doc(db, "alumni", uid)),
      getDoc(doc(db, "alumni", uid, "private", "contact"))
    ]);
    const email = privateSnap.exists() ? privateSnap.data().email : null;
    if (!email) return;
    const fullName = publicSnap.exists() ? publicSnap.data().fullName : "";

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: email,
      to_name: fullName || "Alum"
    });
  } catch (err) {
    console.error("Approval email notification failed:", err);
  }
}

// ── Delete profile ──────────────────────────────────────────────────────
// This permanently removes the Firestore profile doc (and its private
// contact doc). It does NOT delete the person's Firebase Auth login —
// that requires the Admin SDK on a server, or manual removal from
// Firebase Console → Authentication → Users. If they log back in after
// this, they'll land on the "No profile found" screen and can re-register.
async function confirmDelete(uid, name) {
  const ok = confirm(
    `Permanently delete ${name}'s profile?\n\nThis removes their directory listing and contact info, but does NOT remove their login — do that separately in Firebase Console → Authentication → Users if needed.\n\nThis cannot be undone here.`
  );
  if (!ok) return;

  try {
    await deleteDoc(doc(db, "alumni", uid, "private", "contact"));
    await deleteDoc(doc(db, "alumni", uid));
    toast("Profile deleted.", "success");
    loadQueue(activeStatus);
  } catch (err) {
    toast("Couldn't delete this profile.", "error");
    console.error(err);
  }
}

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeStatus = btn.dataset.status;
    loadQueue(activeStatus);
  });
});

(async () => {
  await window.requireAuth();
  loadQueue(activeStatus);
})();
