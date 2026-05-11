import { runApifyActor } from "@/libs/apify";
import { normalizeLinkedinUrl } from "@/libs/linkedinUrls";
import { parseDelimitedList } from "@/libs/sourcingProfile";

/** Lead scraper actor only accepts these country tokens (lowercase). */
const LEAD_SCRAPER_COUNTRY_ENUM = new Set([
  "united states",
  "germany",
  "india",
  "united kingdom",
]);

const LEAD_SCRAPER_COUNTRY_ALIASES = {
  usa: "united states",
  us: "united states",
  "u.s.": "united states",
  "u.s.a.": "united states",
  america: "united states",
  uk: "united kingdom",
  gb: "united kingdom",
  "great britain": "united kingdom",
  britain: "united kingdom",
  england: "united kingdom",
  scotland: "united kingdom",
  wales: "united kingdom",
  "northern ireland": "united kingdom",
  de: "germany",
};

function canonicalLeadScraperCountry(raw) {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!key) return null;
  return LEAD_SCRAPER_COUNTRY_ALIASES[key] ?? key;
}

/**
 * Maps UI / free-text countries to the actor enum. Spillover (unsupported countries)
 * is kept for Google Maps location queries only, not for the lead scraper.
 */
function partitionLeadScraperLocations(raw) {
  const parts = parseDelimitedList(raw);
  const countries = [];
  const spillover = [];
  const seen = new Set();
  for (const part of parts) {
    const canonical = canonicalLeadScraperCountry(part);
    if (canonical && LEAD_SCRAPER_COUNTRY_ENUM.has(canonical)) {
      if (!seen.has(canonical)) {
        seen.add(canonical);
        countries.push(canonical);
      }
      continue;
    }
    const trimmed = String(part).trim();
    if (trimmed) spillover.push(trimmed);
  }
  return { countries, spillover };
}

function leadScraperStateCountryPairs(states, countryCanonList) {
  const out = [];
  const seen = new Set();
  for (const stateRaw of states) {
    const s = String(stateRaw ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (!s) continue;
    for (const c of countryCanonList) {
      const pair = `${s}, ${c}`;
      if (!seen.has(pair)) {
        seen.add(pair);
        out.push(pair);
      }
    }
  }
  return out;
}

/** Drop empty arrays / blank strings so Apify input validation does not reject them. */
function omitEmptyLeadScraperFields(input) {
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }
  return out;
}

export const APIFY_CAMPAIGN_ACTORS = {
  leadScraper: "IoSHqwTR9YGhzccez",
  linkedinProfileScraper: "2SyF0bVxmgGr8IVCZ",
  linkedinCompanyProfileScraper: "UwSdACBp7ymaGUJjS",
  googleMapsScraper: "nwua9Gu5YrADL7ZDj",
};

/**
 * Lead scraper (Apollo-style) input — field names match the actor.
 */
export function buildLeadScraperInput(profile = {}) {
  const p = profile || {};
  const { countries } = partitionLeadScraperLocations(p.contact_location);
  const { countries: notCountries } = partitionLeadScraperLocations(
    p.contact_not_location
  );
  const states = parseDelimitedList(p.contact_state);
  const contact_city =
    states.length > 0 && countries.length > 0
      ? leadScraperStateCountryPairs(states, countries)
      : [];
  const contact_not_city = parseDelimitedList(p.contact_not_city);
  const emailParsed = parseDelimitedList(p.email_status);
  const email_status = emailParsed.length ? emailParsed : ["validated"];

  return omitEmptyLeadScraperFields({
    company_domain: parseDelimitedList(p.company_domain),
    company_industry: parseDelimitedList(p.company_industry),
    company_keywords: parseDelimitedList(p.company_keywords),
    company_not_keywords: parseDelimitedList(p.company_not_keywords),
    contact_city,
    contact_job_title: parseDelimitedList(p.contact_job_title),
    contact_location: countries,
    contact_not_city,
    contact_not_location: notCountries,
    email_status,
    fetch_count: Number(p.fetch_count) > 0 ? Number(p.fetch_count) : 10,
    file_name: (p.file_name && String(p.file_name).trim()) || "prospects",
    functional_level: parseDelimitedList(p.functional_level),
    funding: parseDelimitedList(p.funding),
    max_revenue:
      p.max_revenue != null && String(p.max_revenue).trim() !== ""
        ? String(p.max_revenue).trim()
        : "",
    min_revenue:
      p.min_revenue != null && String(p.min_revenue).trim() !== ""
        ? String(p.min_revenue).trim()
        : "",
    seniority_level: parseDelimitedList(p.seniority_level),
    size: parseDelimitedList(p.size),
  });
}

/**
 * LinkedIn profile scraper — profile URLs from unified sourcing.
 */
export function buildLinkedinProfileScraperInput(profile = {}) {
  const urls = parseDelimitedList(profile?.linkedin_profile_urls);
  return {
    profileUrls: urls,
  };
}

/**
 * LinkedIn company profile scraper — company page URLs from sourcing profile.
 * Input uses `urls: string[]`; rename the key if your actor expects a different name.
 */
export function buildLinkedinCompanyProfileScraperInput(profile = {}) {
  const urls = parseDelimitedList(profile?.linkedin_company_profile_urls);
  return { urls };
}

/**
 * Google Maps scraper — location from cities, states, and countries (free-text
 * ok, e.g. "Bangalore, India"). Place search from company keywords (or defaults).
 */
export function buildGoogleMapsScraperInput(profile = {}) {
  const p = profile || {};
  const mapsOverride =
    typeof p.maps_location_query === "string" && p.maps_location_query.trim()
      ? p.maps_location_query.trim()
      : "";

  const cityPart = Array.isArray(p.contact_city)
    ? p.contact_city.filter(Boolean).join(", ")
    : String(p.contact_city || "").trim();
  const statePart = Array.isArray(p.contact_state)
    ? p.contact_state.filter(Boolean).join(", ")
    : String(p.contact_state || "").trim();
  const locPart = Array.isArray(p.contact_location)
    ? p.contact_location.filter(Boolean).join(", ")
    : String(p.contact_location || "").trim();

  const locationQuery =
    mapsOverride ||
    [cityPart, statePart, locPart].filter(Boolean).join(", ").trim() ||
    "United States";

  const fromMapsOverride = parseDelimitedList(p.maps_search_strings);
  const fromKeywords = parseDelimitedList(p.company_keywords);
  const searchStringsArray =
    fromMapsOverride.length > 0
      ? fromMapsOverride
      : fromKeywords.length > 0
        ? fromKeywords
        : ["business"];

  const maxCrawled = Number(p.maps_max_crawled_places_per_search);
  const maxReviews = Number(p.maps_max_reviews);

  return {
    includeWebResults: Boolean(p.maps_include_web_results),
    language: p.maps_language || "en",
    locationQuery,
    maxCrawledPlacesPerSearch:
      Number.isFinite(maxCrawled) && maxCrawled > 0 ? maxCrawled : 10,
    maxReviews: Number.isFinite(maxReviews) && maxReviews >= 0 ? maxReviews : 0,
    maximumLeadsEnrichmentRecords: 0,
    scrapeContacts: false,
    scrapeDirectories: false,
    scrapeImageAuthors: false,
    scrapePlaceDetailPage: false,
    scrapeReviewsPersonalData: false,
    scrapeSocialMediaProfiles: {
      facebooks: false,
      instagrams: false,
      tiktoks: false,
      twitters: false,
      youtubes: false,
    },
    scrapeTableReservationProvider: false,
    searchStringsArray,
    skipClosedPlaces: false,
    verifyLeadsEnrichmentEmails: false,
  };
}

export async function runLeadScraperFromProfile(profile, options = {}) {
  const input = buildLeadScraperInput(profile);
  return runApifyActor({
    actorId: APIFY_CAMPAIGN_ACTORS.leadScraper,
    input,
    ...options,
  });
}

export async function runLinkedinProfileScraperFromProfile(profile, options = {}) {
  const input = buildLinkedinProfileScraperInput(profile);
  return runApifyActor({
    actorId: APIFY_CAMPAIGN_ACTORS.linkedinProfileScraper,
    input,
    ...options,
  });
}

export async function runGoogleMapsScraperFromProfile(profile, options = {}) {
  const input = buildGoogleMapsScraperInput(profile);
  return runApifyActor({
    actorId: APIFY_CAMPAIGN_ACTORS.googleMapsScraper,
    input,
    ...options,
  });
}

export async function runLinkedinCompanyProfileScraperFromProfile(
  profile,
  options = {}
) {
  const input = buildLinkedinCompanyProfileScraperInput(profile);
  return runApifyActor({
    actorId: APIFY_CAMPAIGN_ACTORS.linkedinCompanyProfileScraper,
    input,
    ...options,
  });
}

export async function runLinkedinProfileScraperForUrls(profileUrls = [], options = {}) {
  const urls = [
    ...new Set(
      profileUrls.map(normalizeLinkedinUrl).filter(Boolean)
    ),
  ];
  if (urls.length === 0) return { run: null, items: [] };
  return runApifyActor({
    actorId: APIFY_CAMPAIGN_ACTORS.linkedinProfileScraper,
    input: { profileUrls: urls },
    fetchResults: options.fetchResults !== false,
    limit: options.limit ?? urls.length + 8,
    testMode: options.testMode,
    maxLeads: options.maxLeads,
  });
}

export async function runLinkedinCompanyProfileScraperForUrls(
  urlsInput = [],
  options = {}
) {
  const urls = [
    ...new Set(urlsInput.map(normalizeLinkedinUrl).filter(Boolean)),
  ];
  if (urls.length === 0) return { run: null, items: [] };
  return runApifyActor({
    actorId: APIFY_CAMPAIGN_ACTORS.linkedinCompanyProfileScraper,
    input: { urls },
    fetchResults: options.fetchResults !== false,
    limit: options.limit ?? urls.length + 8,
    testMode: options.testMode,
    maxLeads: options.maxLeads,
  });
}
