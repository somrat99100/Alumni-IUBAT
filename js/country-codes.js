// js/country-codes.js
// Shared country dial-code list + helpers used by any page that collects a
// phone/WhatsApp number (register.html, my-profile.html). Kept as a single
// source of truth so the "split stored value back into code + local number"
// logic can never drift from the "build the <select>" logic.

// Not every country on Earth — a practical list covering IUBAT's alumni
// footprint (Bangladesh first, since that's the primary audience) plus the
// countries alumni commonly relocate to for work/study. Add more rows here
// if a specific country is missing; nothing else needs to change.
export const COUNTRY_CODES = [
  { iso: "BD", name: "Bangladesh", code: "+880" },
  { iso: "IN", name: "India", code: "+91" },
  { iso: "PK", name: "Pakistan", code: "+92" },
  { iso: "NP", name: "Nepal", code: "+977" },
  { iso: "LK", name: "Sri Lanka", code: "+94" },
  { iso: "MM", name: "Myanmar", code: "+95" },
  { iso: "BT", name: "Bhutan", code: "+975" },
  { iso: "MY", name: "Malaysia", code: "+60" },
  { iso: "SG", name: "Singapore", code: "+65" },
  { iso: "TH", name: "Thailand", code: "+66" },
  { iso: "ID", name: "Indonesia", code: "+62" },
  { iso: "PH", name: "Philippines", code: "+63" },
  { iso: "VN", name: "Vietnam", code: "+84" },
  { iso: "CN", name: "China", code: "+86" },
  { iso: "JP", name: "Japan", code: "+81" },
  { iso: "KR", name: "South Korea", code: "+82" },
  { iso: "AE", name: "UAE", code: "+971" },
  { iso: "SA", name: "Saudi Arabia", code: "+966" },
  { iso: "QA", name: "Qatar", code: "+974" },
  { iso: "KW", name: "Kuwait", code: "+965" },
  { iso: "OM", name: "Oman", code: "+968" },
  { iso: "BH", name: "Bahrain", code: "+973" },
  { iso: "GB", name: "United Kingdom", code: "+44" },
  { iso: "IE", name: "Ireland", code: "+353" },
  { iso: "DE", name: "Germany", code: "+49" },
  { iso: "FR", name: "France", code: "+33" },
  { iso: "IT", name: "Italy", code: "+39" },
  { iso: "ES", name: "Spain", code: "+34" },
  { iso: "NL", name: "Netherlands", code: "+31" },
  { iso: "SE", name: "Sweden", code: "+46" },
  { iso: "NO", name: "Norway", code: "+47" },
  { iso: "FI", name: "Finland", code: "+358" },
  { iso: "PL", name: "Poland", code: "+48" },
  { iso: "PT", name: "Portugal", code: "+351" },
  { iso: "US", name: "United States / Canada", code: "+1" },
  { iso: "AU", name: "Australia", code: "+61" },
  { iso: "NZ", name: "New Zealand", code: "+64" },
  { iso: "ZA", name: "South Africa", code: "+27" },
  { iso: "EG", name: "Egypt", code: "+20" },
  { iso: "TR", name: "Turkey", code: "+90" },
  { iso: "RU", name: "Russia", code: "+7" },
];

// Populate an existing <select> element with every country code, selecting
// `defaultCode` (falls back to Bangladesh, the primary audience for this
// alumni network) if nothing else is chosen yet.
export function buildCountryCodeSelect(selectEl, defaultCode = "+880") {
  selectEl.innerHTML = COUNTRY_CODES.map((c) =>
    `<option value="${c.code}" ${c.code === defaultCode ? "selected" : ""}>${c.iso} (${c.code})</option>`
  ).join("");
  if (![...selectEl.options].some((o) => o.value === defaultCode)) {
    selectEl.value = "+880";
  } else {
    selectEl.value = defaultCode;
  }
}

// Given a full stored number like "+8801712345678", figure out which
// country code it starts with and split off the local part. Matches the
// LONGEST dial code first so e.g. "+1" doesn't shadow a 3-digit code that
// happens to also start with the same leading digit.
export function splitPhoneNumber(full) {
  const value = (full || "").trim();
  if (!value) return { code: "+880", local: "" };
  const byLength = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const c of byLength) {
    if (value.startsWith(c.code)) {
      return { code: c.code, local: value.slice(c.code.length).replace(/^0+/, "") };
    }
  }
  // Unrecognized prefix (or a number saved before this feature existed,
  // with no "+"): keep the digits as the local part and default the code
  // to Bangladesh rather than guessing wrong.
  return { code: "+880", local: value.replace(/^\+?/, "") };
}

// Inverse of splitPhoneNumber: combine a selected dial code with whatever
// digits the person typed into the local-number box into one stored string,
// e.g. ("+880", "01712345678") -> "+8801712345678". Strips everything that
// isn't a digit out of the local part first (spaces, dashes, a leading 0
// some people habitually type after already picking their country code).
export function joinPhoneNumber(code, local) {
  const digits = (local || "").replace(/\D/g, "").replace(/^0+/, "");
  return `${code}${digits}`;
}
