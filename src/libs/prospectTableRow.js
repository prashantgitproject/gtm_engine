import { truncateText } from "@/libs/linkedinUrls";

function trimStr(v) {
  if (v == null || v === "") return "";
  return String(v).trim();
}

function dashOr(val) {
  const s = trimStr(val);
  return s ? s : "—";
}

function joinPieces(parts, sep = " · ") {
  return parts
    .map((x) => (x == null ? "" : String(x).trim()))
    .filter(Boolean)
    .join(sep);
}

function formatEducations(educations, maxItems = 5, maxEach = 140) {
  if (!Array.isArray(educations) || educations.length === 0) return "";
  const lines = [];
  for (const ed of educations.slice(0, maxItems)) {
    const school = trimStr(ed?.title);
    const degree = trimStr(ed?.subtitle);
    const g = trimStr(ed?.grade);
    const p = ed?.period;
    const period =
      p && (trimStr(p.startedOn) || trimStr(p.endedOn))
        ? [trimStr(p.startedOn), trimStr(p.endedOn)].filter(Boolean).join("–")
        : "";
    const one = joinPieces([school, degree, g, period], " — ");
    if (one) lines.push(truncateText(one, maxEach));
  }
  return truncateText(lines.join(" | "), 720);
}

function formatExperiences(experiences, maxItems = 6, maxEach = 160) {
  if (!Array.isArray(experiences) || experiences.length === 0) return "";
  const lines = [];
  for (const ex of experiences.slice(0, maxItems)) {
    const title = trimStr(ex?.title);
    const company = trimStr(ex?.companyName);
    const start = trimStr(ex?.jobStartedOn);
    const end = ex?.jobStillWorking
      ? "present"
      : trimStr(ex?.jobEndedOn);
    const loc = trimStr(ex?.jobLocation);
    const dates =
      start && end
        ? `${start}–${end}`
        : start || end || "";
    let roleLine = "";
    if (title && company) roleLine = `${title} @ ${company}`;
    else if (title) roleLine = title;
    else if (company) roleLine = company;
    const one = joinPieces([roleLine, dates, loc], " · ");
    if (one) lines.push(truncateText(one, maxEach));
  }
  return truncateText(lines.join(" | "), 900);
}

function formatSkills(skills, maxTitles = 28, maxLen = 500) {
  if (!Array.isArray(skills) || skills.length === 0) return "";
  const titles = [];
  for (const s of skills) {
    const t = trimStr(s?.title ?? s?.name ?? s);
    if (t) titles.push(t);
  }
  const uniq = [...new Set(titles)];
  return truncateText(uniq.slice(0, maxTitles).join(", "), maxLen);
}

function companySizeLabel(lead, lc, lm) {
  const n = lead.company_size;
  if (n != null && n !== "" && Number.isFinite(Number(n)))
    return String(Number(n));
  const a = trimStr(lc?.employeeCountRange ?? lc?.companySize);
  if (a) return a;
  const b = trimStr(lm?.companySize);
  return b || "";
}

function buildCompanyDossier(lead, lc, lm) {
  const pieces = [];
  const add = (label, val) => {
    const s = trimStr(val);
    if (s) pieces.push(`${label}: ${s}`);
  };

  add("Industry", lead.industry || lc.industry || lm.companyIndustry);
  const sz = companySizeLabel(lead, lc, lm);
  if (sz) add("Company size", sz);
  add("Seniority (lead)", lead.seniority_level);
  add("Function (lead)", lead.functional_level);
  add("Founded", lead.company_founded_year || lc.foundedOn);
  add(
    "Revenue",
    lead.company_annual_revenue_clean || lead.company_annual_revenue
  );
  add("Funding", lead.company_total_funding_clean);
  add("HQ / reg. address", lead.company_full_address);
  add("Company phone", lead.company_phone);
  const tech = trimStr(lead.company_technologies);
  if (tech) add("Tech stack", truncateText(tech, 220));
  const descLead = trimStr(lead.company_description);
  const descLc = trimStr(lc.description || lc.tagline);
  if (descLead) add("Company description", truncateText(descLead, 240));
  if (descLc && descLc !== descLead)
    add("LinkedIn org summary", truncateText(descLc, 240));

  const specs = lc.specialties;
  if (specs != null) {
    const sp =
      Array.isArray(specs) && specs.length
        ? specs.map((x) => trimStr(x)).filter(Boolean).join(", ")
        : trimStr(specs);
    if (sp) add("Specialties", truncateText(sp, 200));
  }

  const hq = trimStr(lc.headquarter || lc.headquarters || lc.address);
  if (hq) add("LinkedIn HQ", truncateText(hq, 180));

  return truncateText(joinPieces(pieces, " · "), 1100);
}

function phoneForRow(p, maps) {
  return (
    trimStr(p.mobilePhone) ||
    trimStr(maps.phone) ||
    trimStr(maps.phoneUnformatted) ||
    ""
  );
}

/** Org / listing line — not the person’s direct mobile when we can tell. */
function companyPhoneForRow(p, lead, maps, lc) {
  const fromLead = trimStr(lead.company_phone);
  if (fromLead) return fromLead;
  const fromLc =
    trimStr(lc?.phone) ||
    trimStr(lc?.phoneNumber) ||
    trimStr(lc?.primaryPhone);
  if (fromLc) return fromLc;
  const personMobile = trimStr(p.mobilePhone);
  if (!personMobile) {
    return trimStr(maps.phone) || trimStr(maps.phoneUnformatted) || "";
  }
  return "";
}

function companyEmailForRow(lead, maps, lc) {
  return (
    trimStr(lead.company_email) ||
    trimStr(lead.corporate_email) ||
    trimStr(lead.organization_email) ||
    trimStr(lead.business_email) ||
    trimStr(lc?.email) ||
    trimStr(lc?.contactEmail) ||
    trimStr(maps.email) ||
    ""
  );
}

function websiteForRow(p, linkedinCompany, maps) {
  return (
    trimStr(p.companyWebsite) ||
    trimStr(linkedinCompany?.website) ||
    trimStr(maps.website) ||
    ""
  );
}

function linkedinUrlsForRow(p) {
  const person = trimStr(p.personLinkedInUrl);
  const company = trimStr(p.companyLinkedInUrl);
  const urls = [];
  if (person) urls.push({ kind: "person", url: person });
  if (company) urls.push({ kind: "company", url: company });
  return urls;
}

function locationForRow(p, maps, lm, lead) {
  const addr = trimStr(maps.address);
  if (addr) return addr;
  const lmLoc =
    trimStr(lm.addressWithCountry) ||
    trimStr(lm.addressWithoutCountry) ||
    trimStr(lm.jobLocation);
  if (lmLoc) return lmLoc;
  const city =
    trimStr(p.city) ||
    trimStr(maps.city) ||
    trimStr(lead.company_city);
  const state =
    trimStr(p.stateRegion) ||
    trimStr(maps.state) ||
    trimStr(lead.company_state);
  const country =
    trimStr(p.country) ||
    trimStr(maps.countryCode) ||
    trimStr(lead.country) ||
    trimStr(lead.company_country);
  const parts = [city, state, country].filter(Boolean);
  return parts.join(", ");
}

function pincodeForRow(maps, lead) {
  return trimStr(maps.postalCode) || trimStr(lead.company_postal_code) || "";
}

/**
 * Table row + API payload shape for one prospect (used by GET /prospects and drip LLM context).
 */
export function buildProspectTableRow(p, campaignSignals) {
  const lead = p.leadScraper || {};
  const lm = p.linkedinProfile || {};
  const lc = p.linkedinCompany || {};
  const maps = p.googleMaps || {};

  const whyPieces = [
    lm.headline,
    lm.about,
    lead.headline,
    lead.company_description,
    maps.categoryName,
  ]
    .map((x) => (x ? String(x).trim() : ""))
    .filter(Boolean);

  const why =
    truncateText(
      whyPieces[0] || "Fit derived from sourcing filters and enrichment.",
      380
    ) || "—";

  const kwSrc = typeof lead.keywords === "string" ? lead.keywords : "";
  const keywords = kwSrc
    ? kwSrc
        .split(/[,;/]+/)
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

  let signals =
    keywords.length >= 2
      ? keywords.slice(0, 6)
      : Array.isArray(campaignSignals)
        ? campaignSignals.slice(0, 6)
        : [];

  signals = [...new Set(signals)].slice(0, 6);

  const emailRaw = trimStr(p.email) || trimStr(p.personalEmail) || "";

  const seq = Array.isArray(p.dripSequence) ? p.dripSequence : [];

  const linkedinHeadline =
    trimStr(lm.headline) || trimStr(lead.headline) || "";
  const aboutSummary = truncateText(trimStr(lm.about), 360);
  const totalExpYrs =
    typeof lm.totalExperienceYears === "number" &&
    Number.isFinite(lm.totalExperienceYears)
      ? lm.totalExperienceYears
      : null;
  const educationSummary = formatEducations(lm.educations);
  const experienceSummary = formatExperiences(lm.experiences);
  const skillsSummary = formatSkills(lm.skills);
  const companyDossier = buildCompanyDossier(lead, lc, lm);
  const companyPhone = companyPhoneForRow(p, lead, maps, lc);
  const companyEmailRaw = companyEmailForRow(lead, maps, lc);

  return {
    _id: String(p._id),
    prospect:
      (p.companyName && p.companyName.trim()) ||
      (maps.title && maps.title.trim()) ||
      "—",
    person: (p.displayName && p.displayName.trim()) || "—",
    role: (p.jobTitle && p.jobTitle.trim()) || "—",
    email: emailRaw ? emailRaw : "—",
    phone: dashOr(phoneForRow(p, maps)),
    companyEmail: companyEmailRaw ? companyEmailRaw : "—",
    companyPhone: dashOr(companyPhone),
    website: dashOr(websiteForRow(p, lc, maps)),
    linkedinUrls: linkedinUrlsForRow(p),
    location: dashOr(locationForRow(p, maps, lm, lead)),
    pincode: dashOr(pincodeForRow(maps, lead)),
    why,
    signals: signals.length ? signals : [],
    linkedinHeadline: linkedinHeadline || "—",
    aboutSummary: aboutSummary || "—",
    totalExperienceYears: totalExpYrs,
    educationSummary: educationSummary || "—",
    experienceSummary: experienceSummary || "—",
    skillsSummary: skillsSummary || "—",
    companyDossier: companyDossier || "—",
    score: typeof p.displayScore === "number" ? p.displayScore : 55,
    mapsRating: typeof p.mapsRating === "number" ? p.mapsRating : null,
    mapsReviewsCount:
      typeof p.mapsReviewsCount === "number" ? p.mapsReviewsCount : null,
    primarySource: p.primarySource,
    discoveryScore: typeof p.discoveryScore === "number" ? p.discoveryScore : 0,
    dripSequence: seq.map((s) => ({
      day: s.day,
      channel: s.channel,
      subject: s.subject ?? "",
      body: s.body ?? "",
    })),
    dripGeneratedAt: p.dripGeneratedAt ? new Date(p.dripGeneratedAt).toISOString() : null,
  };
}
