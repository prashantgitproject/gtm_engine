/**
 * Unified sourcing criteria for campaigns: one user-facing shape, mapped to
 * Lead scraper / LinkedIn / Google Maps actors in apifyCampaignActors.js
 */

export function parseDelimitedList(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  return String(raw)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parsePositiveInt(raw, fallback) {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

/**
 * Normalize client JSON into a consistent sourcingProfile for Mongo.
 */
export function normalizeSourcingProfile(raw) {
  if (!raw || typeof raw !== "object") return getDefaultSourcingProfile();

  const p = { ...getDefaultSourcingProfile(), ...raw };

  p.contact_not_city = parseDelimitedList(p.contact_not_city);
  p.contact_not_location = parseDelimitedList(p.contact_not_location);
  p.company_domain = parseDelimitedList(p.company_domain);
  p.company_industry = parseDelimitedList(p.company_industry);
  p.company_keywords = parseDelimitedList(p.company_keywords);
  p.company_not_keywords = parseDelimitedList(p.company_not_keywords);
  p.contact_job_title = parseDelimitedList(p.contact_job_title);
  p.email_status = parseDelimitedList(p.email_status).length
    ? parseDelimitedList(p.email_status)
    : ["validated"];
  p.functional_level = parseDelimitedList(p.functional_level);
  p.funding = parseDelimitedList(p.funding);
  p.seniority_level = parseDelimitedList(p.seniority_level);
  p.size = parseDelimitedList(p.size);
  p.linkedin_profile_urls = parseDelimitedList(p.linkedin_profile_urls).map(
    (u) => String(u).trim()
  );
  p.linkedin_company_profile_urls = parseDelimitedList(
    p.linkedin_company_profile_urls
  ).map((u) => String(u).trim());
  p.maps_search_strings = parseDelimitedList(p.maps_search_strings);

  p.fetch_count = parsePositiveInt(p.fetch_count, 10);
  p.maps_max_crawled_places_per_search = parsePositiveInt(
    p.maps_max_crawled_places_per_search,
    10
  );
  p.maps_max_reviews = Math.max(
    0,
    parsePositiveInt(p.maps_max_reviews, 0) || 0
  );

  p.contact_location = parseDelimitedList(p.contact_location);
  p.contact_state = parseDelimitedList(p.contact_state);
  p.contact_city = parseDelimitedList(p.contact_city);
  p.min_revenue =
    typeof p.min_revenue === "string" ? p.min_revenue.trim() : "";
  p.max_revenue =
    typeof p.max_revenue === "string" ? p.max_revenue.trim() : "";
  p.maps_location_query =
    typeof p.maps_location_query === "string"
      ? p.maps_location_query.trim()
      : "";
  p.maps_language =
    typeof p.maps_language === "string" && p.maps_language.trim()
      ? p.maps_language.trim()
      : "en";

  p.maps_include_web_results = Boolean(p.maps_include_web_results);

  p.file_name =
    typeof p.file_name === "string" && p.file_name.trim()
      ? p.file_name.trim()
      : "prospects";

  return p;
}

export function getDefaultSourcingProfile() {
  return {
    contact_location: [],
    contact_state: [],
    contact_city: [],
    contact_not_city: [],
    contact_not_location: [],
    company_domain: [],
    company_industry: [],
    company_keywords: [],
    company_not_keywords: [],
    contact_job_title: [],
    email_status: ["validated"],
    fetch_count: 10,
    file_name: "prospects",
    functional_level: [],
    funding: [],
    max_revenue: "",
    min_revenue: "",
    seniority_level: [],
    size: [],
    linkedin_profile_urls: [],
    linkedin_company_profile_urls: [],
    maps_location_query: "",
    maps_search_strings: [],
    maps_max_crawled_places_per_search: 10,
    maps_max_reviews: 0,
    maps_language: "en",
    maps_include_web_results: false,
  };
}
