/** Normalize whitespace; keep Apify-compatible URL strings */

export function normalizeLinkedinUrl(url) {
  if (!url || typeof url !== "string") return "";
  let u = url.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) {
    if (u.startsWith("linkedin.com") || u.startsWith("www.")) {
      u = `https://${u}`;
    }
  }
  return u.replace(/\/+$/, "");
}

export function linkedinDestinationKind(url) {
  const u = normalizeLinkedinUrl(url).toLowerCase();
  if (!u.includes("linkedin.com")) return null;
  if (u.includes("/company/")) return "company";
  if (u.includes("/school/")) return "company"; // scrape as org page if actor accepts
  if (u.includes("/in/") || /linkedin\.com\/in\//i.test(u)) return "person";
  return null;
}

export function truncateText(text, max = 280) {
  if (text == null) return "";
  const s = String(text).trim();
  if (!s) return "";
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}
