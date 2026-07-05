// js/cloudinary.js
// Handles alumni photo uploads via Cloudinary's free tier (no card required),
// since Firebase Storage now requires the paid Blaze plan.
//
// Before this works, fill in your own values below (see setup-guide.md §3b):
const CLOUDINARY_CLOUD_NAME = "db6r0up6r";
const CLOUDINARY_UPLOAD_PRESET = "alumni";

/**
 * Uploads a File object to Cloudinary and returns its public HTTPS URL.
 * Throws if the file is missing, too large, or the upload fails.
 */
export async function uploadToCloudinary(file) {
  if (!file) throw new Error("No file provided.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Photo must be under 10MB.");
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    throw new Error("Photo must be a JPG or PNG.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "alumni-photos");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    throw new Error("Photo upload failed. Please try again.");
  }

  const data = await res.json();
  return data.secure_url;
}
