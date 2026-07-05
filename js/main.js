// js/main.js
// Small shared helpers used across pages.

export function toast(message, type = "") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`.trim();
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function formatDate(d) {
  if (!d) return "";
  const date = d.toDate ? d.toDate() : new Date(d);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

export function daysBetween(a, b) {
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

export function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
