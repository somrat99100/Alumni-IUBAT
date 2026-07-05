// js/admin.js
import { db } from "./firebase-config.js";
import {
  collection, query, where, getDocs, doc, updateDoc
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
          <div class="row gap-16">
            <img class="avatar" src="${a.photoUrl || "https://placehold.co/56x56/E4EEDF/1F2E22?text=%F0%9F%8C%B1"}" alt="" />
            <div>
              <h3 class="mb-0">${escapeHtml(a.fullName || "Unnamed")}</h3>
              <div class="muted">Batch ${escapeHtml(a.batch || "—")} · Student ID ${escapeHtml(a.studentId || "—")}</div>
            </div>
          </div>
          ${a.jobTitle ? `<p class="mt-16">${escapeHtml(a.jobTitle)}${a.org ? " at " + escapeHtml(a.org) : ""}</p>` : ""}
          ${status === "pending" ? `
            <div class="row gap-12 mt-16">
              <button class="btn btn-primary btn-sm approve-btn" data-uid="${d.id}">Approve</button>
              <button class="btn btn-danger btn-sm reject-btn" data-uid="${d.id}">Reject</button>
            </div>` : ""}
        </div>`;
    }).join("");

    list.querySelectorAll(".approve-btn").forEach((btn) => {
      btn.addEventListener("click", () => decide(btn.dataset.uid, "approved"));
    });
    list.querySelectorAll(".reject-btn").forEach((btn) => {
      btn.addEventListener("click", () => decide(btn.dataset.uid, "rejected"));
    });
  } catch (err) {
    list.innerHTML = `<p class="muted">Couldn't load the queue.</p>`;
    console.error(err);
  }
}

async function decide(uid, status) {
  try {
    await updateDoc(doc(db, "alumni", uid), { status, updatedAt: new Date() });
    toast(`Marked as ${status}.`, "success");
    loadQueue(activeStatus);
  } catch (err) {
    toast("Couldn't update this profile. Check that your admin doc exists.", "error");
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
