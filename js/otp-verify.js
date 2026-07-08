// js/otp-verify.js
// Proves, before an account is ever created, that the person submitting
// register.html actually controls the email address they typed in — this
// is what stops someone from registering using a real alum's email address
// instead of their own.
//
// A random 6-digit code is generated client-side and emailed via EmailJS
// (same account as the admin-approval notification in js/admin.js, but its
// own template — see setup-guide.md).
//
// NOTE: phone/SMS verification was removed — Firebase Phone Auth requires
// the project to be on the paid Blaze billing plan, which isn't in use
// here. Phone/WhatsApp numbers are still collected and stored as before,
// they're just no longer verified by SMS before account creation.

// SETUP REQUIRED (see setup-guide.md):
//  - EmailJS dashboard → create a template with an {{otp_code}} variable
//    (in addition to {{to_email}}/{{to_name}}) and paste its id below.
const EMAILJS_SERVICE_ID = "service_axm0jjz";
const EMAILJS_OTP_TEMPLATE_ID = "template_otp_code"; // replace with your real OTP template id

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendEmailCode(email, fullName, code) {
  if (typeof emailjs === "undefined") {
    throw new Error("Couldn't reach the email verification service — check your connection and try again.");
  }
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_OTP_TEMPLATE_ID, {
      to_email: email,
      to_name: fullName || "there",
      otp_code: code
    });
  } catch (err) {
    // EmailJS rejections come back as a plain {status, text} object, not a
    // real Error — err.message is usually undefined for these, which is
    // why failures used to fall through to a generic, unhelpful message.
    // Surfacing err.text here means a bad template id / service id / a
    // template missing the otp_code variable shows up immediately instead
    // of just "couldn't send the code".
    const detail = err?.text || err?.message || JSON.stringify(err);
    console.error("EmailJS send failed:", err);
    throw new Error(`Couldn't send the email code (${detail}). Check the EmailJS template/service ids.`);
  }
}

// Wires up the "verify email" modal already present in register.html
// (element ids: otpModalOverlay, otpEmailCode, otpStatus, otpError,
// otpConfirmBtn, otpResendBtn, otpCancelBtn) and resolves once the code has
// been confirmed correct. Rejects if the person cancels — callers should
// treat that as "stop, don't create the account" rather than a real error.
//
// `phone` is accepted but intentionally unused — kept in the call signature
// so register.html doesn't need to change how it calls this function.
export function verifyContactInfo({ email, fullName, phone }) {
  return new Promise((resolve, reject) => {
    const overlay = document.getElementById("otpModalOverlay");
    const emailInput = document.getElementById("otpEmailCode");
    const confirmBtn = document.getElementById("otpConfirmBtn");
    const cancelBtn = document.getElementById("otpCancelBtn");
    const resendBtn = document.getElementById("otpResendBtn");
    const errorEl = document.getElementById("otpError");
    const statusEl = document.getElementById("otpStatus");

    let expectedEmailCode = null;
    let settled = false;

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.hidden = !msg;
    }
    function showStatus(msg) {
      statusEl.textContent = msg;
    }

    async function sendCode() {
      confirmBtn.disabled = true;
      resendBtn.disabled = true;
      showError("");
      showStatus("Sending code…");
      emailInput.value = "";

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

      showStatus("Code sent — check your email.");
      confirmBtn.disabled = false;
      resendBtn.disabled = false;
    }

    function onConfirm() {
      showError("");
      const enteredEmailCode = emailInput.value.trim();
      if (!enteredEmailCode) {
        showError("Enter the code to continue.");
        return;
      }
      if (!expectedEmailCode) {
        showError("The code is still being sent — wait a moment and try again.");
        return;
      }

      if (enteredEmailCode !== expectedEmailCode) {
        showError("That code doesn't match. Double-check it or resend.");
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
      resendBtn.removeEventListener("click", sendCode);
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Confirm & create account";
    }

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    resendBtn.addEventListener("click", sendCode);

    overlay.hidden = false;
    showStatus("");
    showError("");
    sendCode();
  });
}
