// js/profile.js
import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { uploadToCloudinary } from "./cloudinary.js";
import { toast, escapeHtml } from "./main.js";

let jobHistory = [];
let photoFile = null;
let uid = null;

async function init() {
  const user = await window.requireAuth();
  if (!user) return;
  uid = user.uid;

  const [publicSnap, privateSnap] = await Promise.all([
    getDoc(doc(db, "alumni", uid)),
    getDoc(doc(db, "alumni", uid, "private", "contact"))
  ]);

  if (!publicSnap.exists()) {
    toast("No profile found for this account.", "error");
    return;
  }
  const data = publicSnap.data();
  const priv = privateSnap.exists() ? privateSnap.data() : {};

  renderStatusBanner(data.status);

  document.getElementById("fullName").value = data.fullName || "";
  document.getElementById("batch").value = data.batch || "";
  document.getElementById("jobTitle").value = data.jobTitle || "";
  document.getElementById("org").value = data.org || "";
  document.getElementById("researchArea").value = data.researchArea || "";
  document.getElementById("email").value = priv.email || "";
  document.getElementById("phone").value = priv.phone || "";
  document.getElementById("whatsapp").value = priv.whatsapp || "";
  document.getElementById("facebookUrl").value = priv.facebookUrl || "";
  document.getElementById("linkedinUrl").value = priv.linkedinUrl || "";
  document.getElementById("phonePublic").checked = data.visibility?.phone === "public";
  document.getElementById("whatsappPublic").checked = data.visibility?.whatsapp === "public";
  if (data.photoUrl) document.getElementById("avatarPreview").src = data.photoUrl;

  jobHistory = data.jobHistory || [];
  renderJobHistory();

  loadIncomingRequests(uid);
}

function renderStatusBanner(status) {
  const banner = document.getElementById("statusBanner");
  const map = {
    pending: { cls: "badge-pending", text: "Your profile is pending admin review — it isn't visible in the directory yet." },
    approved: { cls: "badge-approved", text: "Your profile is live in the directory." },
    rejected: { cls: "badge-rejected", text: "Your profile was not approved. Update your details and it will be reviewed again." }
  };
  const s = map[status] || map.pending;
  banner.innerHTML = `<span class="badge ${s.cls}">${status || "pending"}</span> <span class="muted">${s.text}</span>`;
}

function renderJobHistory() {
  const list = document.getElementById("jobHistoryList");
  list.innerHTML = jobHistory.map((j, i) => `
    <div class="job-row" data-index="${i}">
      <div class="field mb-0">
        <label>Title</label>
        <input type="text" class="job-title" value="${escapeHtml(j.title || "")}" />
      </div>
      <div class="field mb-0">
        <label>Organization</label>
        <input type="text" class="job-org" value="${escapeHtml(j.org || "")}" />
      </div>
      <button type="button" class="btn btn-ghost btn-sm remove-job">Remove</button>
    </div>
    <div class="form-row" style="margin-top:-6px; margin-bottom:14px;">
      <div class="field mb-0">
        <label>Start date</label>
        <input type="text" class="job-start" placeholder="e.g. 2019" value="${escapeHtml(j.startDate || "")}" />
      </div>
      <div class="field mb-0">
        <label>End date</label>
        <input type="text" class="job-end" placeholder="Present" value="${escapeHtml(j.endDate || "")}" />
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".remove-job").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      jobHistory = collectJobHistoryFromDom();
      const idx = parseInt(e.target.closest(".job-row").dataset.index, 10);
      jobHistory.splice(idx, 1);
      renderJobHistory();
    });
  });
}

document.getElementById("addJobBtn").addEventListener("click", () => {
  // Sync from the DOM first — otherwise any unsaved edits in existing rows
  // get wiped when renderJobHistory() re-renders from the stale array.
  jobHistory = collectJobHistoryFromDom();
  jobHistory.push({ title: "", org: "", startDate: "", endDate: "" });
  renderJobHistory();
});

function collectJobHistoryFromDom() {
  const rows = document.querySelectorAll("#jobHistoryList .job-row");
  return Array.from(rows).map((row) => ({
    title: row.querySelector(".job-title").value.trim(),
    org: row.querySelector(".job-org").value.trim(),
    startDate: row.nextElementSibling.querySelector(".job-start").value.trim(),
    endDate: row.nextElementSibling.querySelector(".job-end").value.trim()
  }));
}

document.getElementById("photoInput").addEventListener("change", (e) => {
  photoFile = e.target.files[0] || null;
  if (photoFile) document.getElementById("avatarPreview").src = URL.createObjectURL(photoFile);
});

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("saveBtn");
  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    let photoUrl;
    if (photoFile) {
      photoUrl = await uploadToCloudinary(photoFile);
    }

    const updates = {
      fullName: document.getElementById("fullName").value.trim(),
      batch: document.getElementById("batch").value.trim(),
      jobTitle: document.getElementById("jobTitle").value.trim(),
      org: document.getElementById("org").value.trim(),
      researchArea: document.getElementById("researchArea").value.trim(),
      jobHistory: collectJobHistoryFromDom(),
      visibility: {
        phone: document.getElementById("phonePublic").checked ? "public" : "private",
        whatsapp: document.getElementById("whatsappPublic").checked ? "public" : "private"
      },
      updatedAt: new Date()
    };
    if (photoUrl) updates.photoUrl = photoUrl;

    await updateDoc(doc(db, "alumni", uid), updates);

    await setDoc(doc(db, "alumni", uid, "private", "contact"), {
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      whatsapp: document.getElementById("whatsapp").value.trim(),
      facebookUrl: document.getElementById("facebookUrl").value.trim(),
      linkedinUrl: document.getElementById("linkedinUrl").value.trim()
    });

    toast("Profile saved.", "success");
  } catch (err) {
    toast(err.message || "Couldn't save changes.", "error");
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = "Save changes";
  }
});

async function loadIncomingRequests(uid) {
  const list = document.getElementById("requestsList");
  try {
    const q = query(collection(db, "contactRequests"), where("toUid", "==", uid));
    const snap = await getDocs(q);
    if (snap.empty) {
      list.innerHTML = `<p class="muted">No contact requests yet.</p>`;
      return;
    }
    list.innerHTML = snap.docs.map((d) => {
      const r = d.data();
      return `
        <div class="card mt-16">
          <div class="row" style="justify-content:space-between;">
            <span class="badge badge-${r.status}">${r.status}</span>
          </div>
          <p class="mt-8"><strong>Purpose:</strong> ${escapeHtml(r.purpose || "")}</p>
          <p class="muted">${escapeHtml(r.message || "")}</p>
          ${r.status === "pending" ? `
            <div class="row gap-12 mt-16">
              <button class="btn btn-primary btn-sm approve-btn" data-id="${d.id}">Approve</button>
              <button class="btn btn-danger btn-sm reject-btn" data-id="${d.id}">Decline</button>
            </div>` : ""}
        </div>`;
    }).join("");

    list.querySelectorAll(".approve-btn").forEach((btn) => {
      btn.addEventListener("click", () => decide(btn.dataset.id, "approved"));
    });
    list.querySelectorAll(".reject-btn").forEach((btn) => {
      btn.addEventListener("click", () => decide(btn.dataset.id, "rejected"));
    });
  } catch (err) {
    list.innerHTML = `<p class="muted">Couldn't load requests.</p>`;
    console.error(err);
  }
}

async function decide(reqId, status) {
  try {
    await updateDoc(doc(db, "contactRequests", reqId), { status, decidedAt: new Date() });
    toast(status === "approved" ? "Request approved." : "Request declined.", "success");
    loadIncomingRequests(uid);
  } catch (err) {
    toast("Couldn't update the request.", "error");
    console.error(err);
  }
}

init();
