// js/otp-verify.js
// Proves, before an account is ever created, that the person submitting
// register.html actually controls the email address AND the phone number
// they typed in — this is what stops someone from registering using a real
// alum's contact info instead of their own.
//
// Email code: a random 6-digit code generated client-side and emailed via
// EmailJS (same account as the admin-approval notification in js/admin.js,
// but its own template — see setup-guide.md).
// Phone code: a REAL SMS one-time code sent through Firebase Phone
// Authentication. It runs on a SEPARATE, secondary Firebase App instance
// (same project, independent Auth session) so that whatever temporary
// session signInWithPhoneNumber() creates never touches the primary Auth
// instance that register.html uses moments later for the real
// createUserWithEmailAndPassword() call.

import { app } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// SETUP REQUIRED (see setup-guide.md):
//  - Firebase Console → Authentication → Sign-in method → enable "Phone".
//  - EmailJS dashboard → create a template with an {{otp_code}} variable
//    (in addition to {{to_email}}/{{to_name}}) and paste its id below.
const EMAILJS_SERVICE_ID = "service_axm0jjz";
const EMAILJS_OTP_TEMPLATE_ID = "template_otp_code"; // replace with your real OTP template id

let otpApp = null;
function getOtpAuth() {
  // Lazily create the secondary app on first use, reuse it after that.
  if (!otpApp) otpApp = initializeApp(app.options, "otpVerifyApp");
  return getAuth(otpApp);
}

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendEmailCode(email, fullName, code) {
  if (typeof emailjs === "undefined") {
    throw new Error("Couldn't reach the email verification service — check your connection and try again.");
  }
  await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_OTP_TEMPLATE_ID, {
    to_email: email,
    to_name: fullName || "there",
    otp_code: code
  });
}

function friendlyPhoneError(err) {
  const code = err?.code || "";
  if (code.includes("invalid-phone-number")) return "That phone number doesn't look valid for SMS delivery — check the country code and number.";
  if (code.includes("too-many-requests")) return "Too many attempts — wait a bit before requesting another SMS code.";
  if (code.includes("quota-exceeded")) return "SMS verification is temporarily unavailable — try again later.";
  return "Couldn't send the SMS code. Check the phone number and try resending.";
}

// Wires up the "verify email + phone" modal already present in register.html
// (element ids: otpModalOverlay, otpEmailCode, otpPhoneCode, otpRecaptcha,
// otpStatus, otpError, otpConfirmBtn, otpResendBtn, otpCancelBtn) and
// resolves once BOTH codes have been confirmed correct. Rejects if the
// person cancels — callers should treat that as "stop, don't create the
// account" rather than a real error.
export function verifyContactInfo({ email, fullName, phone }) {
  return new Promise((resolve, reject) => {
    const overlay = document.getElementById("otpModalOverlay");
    const emailInput = document.getElementById("otpEmailCode");
    const phoneInput = document.getElementById("otpPhoneCode");
    const confirmBtn = document.getElementById("otpConfirmBtn");
    const cancelBtn = document.getElementById("otpCancelBtn");
    const resendBtn = document.getElementById("otpResendBtn");
    const errorEl = document.getElementById("otpError");
    const statusEl = document.getElementById("otpStatus");

    let expectedEmailCode = null;
    let confirmationResult = null;
    let recaptchaVerifier = null;
    let settled = false;

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.hidden = !msg;
    }
    function showStatus(msg) {
      statusEl.textContent = msg;
    }

    async function sendBoth() {
      confirmBtn.disabled = true;
      resendBtn.disabled = true;
      confirmationResult = null;
      showError("");
      showStatus("Sending codes…");
      emailInput.value = "";
      phoneInput.value = "";

      try {
        expectedEmailCode = randomCode();
        await sendEmailCode(email, fullName, expectedEmailCode);
      } catch (err) {
        showStatus("");
        showError(err.message || "Couldn't send the email code. Try resending.");
        confirmBtn.disabled = false;
        resendBtn.disabled = false;
        return;
      }

      try {
        const otpAuth = getOtpAuth();
        // A fresh verifier every send — reusing one after a previous
        // confirm/expiry throws, so tear down and rebuild the widget.
        if (recaptchaVerifier) {
          try { recaptchaVerifier.clear(); } catch (_) { /* ignore */ }
        }
        document.getElementById("otpRecaptcha").innerHTML = "";
        recaptchaVerifier = new RecaptchaVerifier(otpAuth, "otpRecaptcha", { size: "invisible" });
        confirmationResult = await signInWithPhoneNumber(otpAuth, phone, recaptchaVerifier);
      } catch (err) {
        showStatus("");
        showError(friendlyPhoneError(err));
        confirmBtn.disabled = false;
        resendBtn.disabled = false;
        return;
      }

      showStatus("Codes sent — check your email and SMS messages.");
      confirmBtn.disabled = false;
      resendBtn.disabled = false;
    }

    async function onConfirm() {
      showError("");
      const enteredEmailCode = emailInput.value.trim();
      const enteredPhoneCode = phoneInput.value.trim();
      if (!enteredEmailCode || !enteredPhoneCode) {
        showError("Enter both codes to continue.");
        return;
      }
      if (!confirmationResult) {
        showError("Codes are still being sent — wait a moment and try again.");
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.textContent = "Verifying…";

      if (enteredEmailCode !== expectedEmailCode) {
        showError("That email code doesn't match. Double-check it or resend.");
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm & create account";
        return;
      }

      try {
        // Real proof of SMS receipt — validated against Firebase's phone
        // auth backend, not just a local string comparison like the email
        // code above.
        await confirmationResult.confirm(enteredPhoneCode);
        // We only needed proof of receipt, not a session — sign the
        // temporary phone-auth user straight back out.
        await signOut(getOtpAuth());
      } catch (err) {
        showError("That SMS code doesn't match. Double-check it or resend.");
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm & create account";
        return;
      }

      cleanup();
      resolve();
    }

    function onCancel() {
      cleanup();
      reject(new Error("cancelled"));
    }

    function cleanup() {
      if (settled) return;
      settled = true;
      overlay.hidden = true;
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      resendBtn.removeEventListener("click", sendBoth);
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Confirm & create account";
      if (recaptchaVerifier) {
        try { recaptchaVerifier.clear(); } catch (_) { /* ignore */ }
      }
    }

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    resendBtn.addEventListener("click", sendBoth);

    overlay.hidden = false;
    showStatus("");
    showError("");
    sendBoth();
  });
}
