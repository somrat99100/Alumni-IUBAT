// js/profile.js
import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs,
  addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { uploadToCloudinary } from "./cloudinary.js";
import { toast, escapeHtml } from "./main.js";
import { buildCountryCodeSelect, splitPhoneNumber, joinPhoneNumber } from "./country-codes.js";

let jobHistory = [];
let photoFile = null;
let uid = null;
let myFullName = ""; // used as the "aboutName" on approval notifications

// Snapshot of the currently-live (approved) data, captured in init() before
// any edits happen. Used to decide whether this save is the FIRST time the
// profile is being edited since it was last approved — if so, that snapshot
// gets stored as `previousApproved` so the admin review queue can show
// exactly what changed (see js/admin.js).
let originalStatus = null;
let originalPublicData = null;
let originalPrivateData = null;

buildCountryCodeSelect(document.getElementById("phoneCode"), "+880");
buildCountryCodeSelect(document.getElementById("whatsappCode"), "+880");

async function init() {
  const user = await window.requireAuth();
  if (!user) return;
  uid = user.uid;

  const [publicSnap, privateSnap] = await Promise.all([
    getDoc(doc(db, "alumni", uid)),
    getDoc(doc(db, "alumni", uid, "private", "contact"))
  ]);

  if (!publicSnap.exists()) {
    document.getElementById("profileFormSection").hidden = true;
    const pendingNotice = document.getElementById("pendingNotice");
    pendingNotice.hidden = false;
    pendingNotice.innerHTML = `
      <p style="font-size:2.5rem; margin-bottom:8px;">⚠️</p>
      <h2>No profile found for this account</h2>
      <p class="muted" style="max-width:440px; margin:0 auto;">
        Your login exists, but no profile was saved for it — this can happen if
        registration was interrupted. Please contact the admin, or
        <a href="register.html">register again</a> with a different email.
      </p>`;
    return;
  }
  const data = publicSnap.data();
  const priv = privateSnap.exists() ? privateSnap.data() : {};
  myFullName = data.fullName || "";
  originalStatus = data.status || "pending";
  originalPublicData = data;
  originalPrivateData = priv;

  renderStatusBanner(data.status, data.everApproved);

  const pendingNotice = document.getElementById("pendingNotice");
  const formSection = document.getElementById("profileFormSection");

  // Only hide the form for a brand-new profile that has NEVER been approved
  // yet. Once a profile has been approved at least once, edits stay fully
  // editable — saving just re-submits for review (see the submit handler
  // below) without locking the person out of their own form.
  const isFirstTimePending = data.status === "pending" && !data.everApproved;

  if (isFirstTimePending) {
    pendingNotice.hidden = false;
    pendingNotice.innerHTML = `
      <p style="font-size:2.5rem; margin-bottom:8px;">⏳</p>
      <h2>Your profile is under review</h2>
      <p class="muted" style="max-width:440px; margin:0 auto;">
        An admin needs to approve your profile before it appears in the directory.
        Please keep patience — once it's approved, you'll be able to see and edit
        all your details here, including your photo.
      </p>`;
    formSection.hidden = true;
    return; // nothing else to populate while the form is hidden
  }
  pendingNotice.hidden = true;
  formSection.hidden = false;

  document.getElementById("fullName").value = data.fullName || "";
  document.getElementById("batch").value = data.batch || "";
  document.getElementById("jobTitle").value = data.jobTitle || "";
  document.getElementById("org").value = data.org || "";
  document.getElementById("researchArea").value = data.researchArea || "";
  document.getElementById("email").value = priv.email || "";
  const phoneSplit = splitPhoneNumber(priv.phone);
  document.getElementById("phoneCode").value = phoneSplit.code;
  document.getElementById("phone").value = phoneSplit.local;
  const whatsappSplit = splitPhoneNumber(priv.whatsapp);
  document.getElementById("whatsappCode").value = whatsappSplit.code;
  document.getElementById("whatsapp").value = whatsappSplit.local;
  document.getElementById("facebookUrl").value = priv.facebookUrl || data.facebookUrl || "";
  document.getElementById("linkedinUrl").value = priv.linkedinUrl || data.linkedinUrl || "";
  document.getElementById("phonePublic").checked = data.visibility?.phone === "public";
  document.getElementById("whatsappPublic").checked = data.visibility?.whatsapp === "public";
  if (data.photoUrl) document.getElementById("avatarPreview").src = data.photoUrl;

  jobHistory = data.jobHistory || [];
  renderJobHistory();

  loadIncomingRequests(uid);
}

function renderStatusBanner(status, everApproved) {
  const banner = document.getElementById("statusBanner");
  const map = {
    pending: {
      cls: "badge-pending",
      text: everApproved
        ? "Your latest changes are pending admin review. The directory still shows your last approved version until this is reviewed."
        : "Your profile is pending admin review — it isn't visible in the directory yet."
    },
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

  // Defensive validation, mirroring the HTML pattern attributes.
  const batchVal = document.getElementById("batch").value.trim();
  if (!/^\d{3}$/.test(batchVal)) {
    toast("Batch must be exactly 3 digits, e.g. 242.", "error");
    return;
  }
  const fbVal = document.getElementById("facebookUrl").value.trim();
  if (!/^https?:\/\/(www\.)?(facebook|fb)\.com\/.+/i.test(fbVal)) {
    toast("Enter a real Facebook profile URL, e.g. https://facebook.com/yourname.", "error");
    return;
  }
  // LinkedIn is optional — only validate the pattern if something was entered.
  const liVal = document.getElementById("linkedinUrl").value.trim();
  if (liVal && !/^https?:\/\/(www\.)?linkedin\.com\/.+/i.test(liVal)) {
    toast("Enter a real LinkedIn profile URL, e.g. https://linkedin.com/in/yourname.", "error");
    return;
  }
  // Email here is a separate free-text field (not the Firebase Auth login
  // email), so it never goes through Auth's own validation — this is the
  // only client-side check for it, backed up by isValidContact() in the
  // Firestore rules as the real enforcement layer.
  const emailVal = document.getElementById("email").value.trim().toLowerCase();
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(emailVal)) {
    toast("Enter a valid email address.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    let photoUrl;
    if (photoFile) {
      photoUrl = await uploadToCloudinary(photoFile);
    }

    const phoneVal = joinPhoneNumber(document.getElementById("phoneCode").value, document.getElementById("phone").value);
    const whatsappVal = joinPhoneNumber(document.getElementById("whatsappCode").value, document.getElementById("whatsapp").value);
    if (!/^\+?[0-9]{7,15}$/.test(phoneVal)) {
      toast("Enter a valid phone number for the selected country code.", "error");
      btn.disabled = false;
      btn.textContent = "Save changes";
      return;
    }
    if (!/^\+?[0-9]{7,15}$/.test(whatsappVal)) {
      toast("Enter a valid WhatsApp number for the selected country code.", "error");
      btn.disabled = false;
      btn.textContent = "Save changes";
      return;
    }
    const phonePublic = document.getElementById("phonePublic").checked;
    const whatsappPublic = document.getElementById("whatsappPublic").checked;

    const updates = {
      fullName: document.getElementById("fullName").value.trim(),
      batch: batchVal,
      jobTitle: document.getElementById("jobTitle").value.trim(),
      org: document.getElementById("org").value.trim(),
      researchArea: document.getElementById("researchArea").value.trim(),
      facebookUrl: fbVal,
      linkedinUrl: liVal,
      publicPhone: phonePublic ? phoneVal : "",
      publicWhatsapp: whatsappPublic ? whatsappVal : "",
      jobHistory: collectJobHistoryFromDom(),
      visibility: {
        phone: phonePublic ? "public" : "private",
        whatsapp: whatsappPublic ? "public" : "private"
      },
      // Any edit sends the profile back for admin review. The directory
      // query only shows status === "approved", so the *previous* approved
      // version disappears from public view the moment this saves, and the
      // new version only reappears once an admin re-approves it.
      status: "pending",
      updatedAt: new Date()
    };
    if (photoUrl) updates.photoUrl = photoUrl;

    // If this profile is CURRENTLY live (approved) and is only now being
    // edited for the first time since that approval, snapshot the
    // still-live values before they get overwritten below. The admin
    // review queue diffs this snapshot against the incoming pending values
    // to show reviewers exactly what changed (js/admin.js). If the profile
    // was already pending/rejected (i.e. this isn't the first edit since
    // the last approval), leave any existing snapshot alone so the diff
    // keeps comparing against the last version that was truly live.
    if (originalStatus === "approved") {
      updates.previousApproved = {
        fullName: originalPublicData.fullName || "",
        batch: originalPublicData.batch || "",
        jobTitle: originalPublicData.jobTitle || "",
        org: originalPublicData.org || "",
        researchArea: originalPublicData.researchArea || "",
        photoUrl: originalPublicData.photoUrl || "",
        facebookUrl: originalPublicData.facebookUrl || "",
        linkedinUrl: originalPublicData.linkedinUrl || "",
        jobHistory: originalPublicData.jobHistory || [],
        visibility: originalPublicData.visibility || {},
        email: originalPrivateData.email || "",
        phone: originalPrivateData.phone || "",
        whatsapp: originalPrivateData.whatsapp || ""
      };
    }

    await updateDoc(doc(db, "alumni", uid), updates);

    await setDoc(doc(db, "alumni", uid, "private", "contact"), {
      email: emailVal,
      phone: phoneVal,
      whatsapp: whatsappVal,
      facebookUrl: fbVal,
      linkedinUrl: liVal
    });

    toast("Changes saved and submitted for admin review.", "success");
    document.getElementById("statusBanner").innerHTML =
      `<span class="badge badge-pending">pending</span> <span class="muted">Your latest changes are pending admin review. The directory still shows your last approved version until this is reviewed.</span>`;

    // Reflect the save locally so a second save later in the same page
    // load doesn't re-snapshot (and overwrite) the previousApproved data
    // that was just written above.
    originalStatus = "pending";
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
              <button class="btn btn-primary btn-sm approve-btn" data-id="${d.id}" data-from="${r.fromUid}">Approve</button>
              <button class="btn btn-danger btn-sm reject-btn" data-id="${d.id}">Decline</button>
            </div>` : ""}
        </div>`;
    }).join("");

    list.querySelectorAll(".approve-btn").forEach((btn) => {
      btn.addEventListener("click", () => decide(btn.dataset.id, "approved", btn.dataset.from));
    });
    list.querySelectorAll(".reject-btn").forEach((btn) => {
      btn.addEventListener("click", () => decide(btn.dataset.id, "rejected"));
    });
  } catch (err) {
    list.innerHTML = `<p class="muted">Couldn't load requests.</p>`;
    console.error(err);
  }
}

async function decide(reqId, status, fromUid) {
  try {
    await updateDoc(doc(db, "contactRequests", reqId), { status, decidedAt: new Date() });
    toast(status === "approved" ? "Request approved." : "Request declined.", "success");

    // Best-effort: never let a notification hiccup undo or block the
    // approval that already succeeded above.
    if (status === "approved" && fromUid) {
      notifyApproval(fromUid, reqId);
    }

    loadIncomingRequests(uid);
  } catch (err) {
    toast("Couldn't update the request.", "error");
    console.error(err);
  }
}

// Creates an in-app notification for the person whose contact request was
// just approved, so they see "your request was accepted — view now" next
// time they load any page (via the navbar bell in navbar-loader.js).
async function notifyApproval(toUid, reqId) {
  try {
    const ref = await addDoc(collection(db, "notifications"), {
      toUid,
      type: "contact_approved",
      aboutUid: uid,
      aboutName: myFullName || "An alum",
      requestId: reqId,
      read: false,
      createdAt: serverTimestamp()
    });
    console.log(`[notifications] created ${ref.id} for toUid=${toUid} aboutUid=${uid}`);
  } catch (err) {
    console.error("Couldn't create approval notification:", err);
  }
}

init();