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
 * Google Maps scraper — uses only maps_* sourcing fields (see campaign modal).
 * Location + search terms come from the profile; other actor flags stay fixed.
 */
export function buildGoogleMapsScraperInput(profile = {}) {
  const p = profile || {};
  const locationQuery =
    typeof p.maps_location_query === "string"
      ? p.maps_location_query.trim()
      : "";
  const searchStringsArray = parseDelimitedList(p.maps_search_strings);
  const maxCrawled = Number(p.maps_max_crawled_places_per_search);

  return {
    includeWebResults: false,
    language: "en",
    locationQuery,
    maxCrawledPlacesPerSearch:
      Number.isFinite(maxCrawled) && maxCrawled > 0 ? maxCrawled : 10,
    maxReviews: 0,
    maximumLeadsEnrichmentRecords: 1,
    placeMinimumStars: "threeAndHalf",
    scrapeContacts: true,
    scrapeDirectories: false,
    scrapeImageAuthors: false,
    scrapePlaceDetailPage: false,
    scrapeReviewsPersonalData: false,
    scrapeSocialMediaProfiles: {
      facebooks: false,
      instagrams: true,
      tiktoks: false,
      twitters: false,
      youtubes: false,
    },
    scrapeTableReservationProvider: false,
    searchStringsArray,
    skipClosedPlaces: false,
    verifyLeadsEnrichmentEmails: false,
    website: "withWebsite",
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
  if (
    !input.locationQuery ||
    !Array.isArray(input.searchStringsArray) ||
    input.searchStringsArray.length === 0
  ) {
    return { run: null, items: [] };
  }
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
