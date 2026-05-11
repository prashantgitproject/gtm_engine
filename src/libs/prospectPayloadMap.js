/**
 * Maps raw Apify outputs into Prospect root fields used for query/display.
 * Merging strategy for account_book can layer these (profile/company overrides lead row).
 */

function str(v) {
  if (v == null || v === "") return "";
  return String(v).trim();
}

/** Lead scraper — snake_case field names */
export function fieldsFromLeadScraperRow(item = {}) {
  const fn = str(item.first_name);
  const ln = str(item.last_name);
  const full = str(item.full_name) || [fn, ln].filter(Boolean).join(" ");

  return {
    displayName: full,
    email: item.email ? str(item.email) : "",
    personalEmail: item.personal_email ? str(item.personal_email) : "",
    mobilePhone: item.mobile_number ? str(item.mobile_number) : "",
    jobTitle: str(item.job_title),
    companyName: str(item.company_name),
    companyWebsite: str(item.company_website),
    companyDomain: str(item.company_domain).toLowerCase(),
    city: str(item.city),
    stateRegion: str(item.state),
    country: str(item.country),
    personLinkedInUrl: str(item.linkedin),
    companyLinkedInUrl: str(item.company_linkedin),
    companyLinkedInUid: str(item.company_linkedin_uid),
    googleMapsPlaceUrl: "",
  };
}

/** Google Maps Places-style row */
export function fieldsFromGoogleMapsRow(item = {}) {
  return {
    displayName: str(item.title),
    companyName: str(item.title),
    city: str(item.city),
    stateRegion: str(item.state),
    country: str(item.countryCode),
    googleMapsPlaceUrl: str(item.url),
  };
}

/** LinkedIn person profile actor — camelCase fields */
export function fieldsFromLinkedinProfileRow(item = {}) {
  return {
    displayName: str(item.fullName) || [item.firstName, item.lastName].filter(Boolean).map(str).join(" "),
    email: item.email ? str(item.email) : "",
    personalEmail: "",
    mobilePhone: item.mobileNumber ? str(item.mobileNumber) : "",
    jobTitle: str(item.jobTitle),
    companyName: str(item.companyName),
    companyWebsite: str(item.companyWebsite),
    country: "",
    city: "",
    personLinkedInUrl: str(item.linkedinUrl),
    companyLinkedInUrl: "",
  };
}

/** LinkedIn company profile actor row */
export function fieldsFromLinkedinCompanyRow(item = {}) {
  return {
    companyName: str(item.name),
    companyWebsite: str(item.website),
    companyLinkedInUrl: str(item.linkedinUrl),
    companyLinkedInUid: item.id != null ? str(item.id) : "",
  };
}

/**
 * Merge into a plain Prospect patch — later fields win for non-empty values.
 */
export function mergeProspectFlatFields(prev = {}, patches = []) {
  const keys = [
    "displayName",
    "email",
    "personalEmail",
    "mobilePhone",
    "jobTitle",
    "companyName",
    "companyWebsite",
    "companyDomain",
    "city",
    "stateRegion",
    "country",
    "googleMapsPlaceUrl",
    "personLinkedInUrl",
    "companyLinkedInUrl",
    "companyLinkedInUid",
  ];

  const out = {};
  for (const k of keys) {
    const v = prev[k];
    out[k] = v != null && v !== "" ? String(v) : "";
  }

  function applyPatch(p = {}) {
    for (const k of keys) {
      if (!(k in p)) continue;
      const v = p[k];
      if (v !== "" && v !== null && v !== undefined) {
        out[k] = k === "companyDomain" ? String(v).toLowerCase() : String(v);
      }
    }
  }

  for (const p of patches) applyPatch(p);
  return out;
}
