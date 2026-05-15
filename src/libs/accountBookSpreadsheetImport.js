import * as XLSX from "xlsx";
import mongoose from "mongoose";
import { Campaign } from "@/models/Campaign";
import { Prospect } from "@/models/Prospect";
import { connectDB } from "@/libs/db";
import { computeLeadBaselineScores } from "@/libs/discoveryScore";
import {
  linkedinDestinationKind,
  normalizeLinkedinUrl,
} from "@/libs/linkedinUrls";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_DATA_ROWS = 2500;
const INSERT_CHUNK = 400;

/** Slug for header match: "PIN / ZIP" → "pin_zip", "LinkedIn (person)" → "linkedin_person" */
function slugHeader(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const PROSPECT_EXTRA_SLUGS = new Set([
  "prospect",
  "organization",
  "account",
  "employer",
  "business",
  "company",
]);

const PERSON_EXTRA_SLUGS = new Set([
  "contact_person",
  "contact_name",
  "full_name",
  "representative",
]);

function hasProspectColumn(slugToIndex, headerSlugs) {
  if (pickIndexFromAliases(slugToIndex, HEADER_ALIASES.prospect) >= 0)
    return true;
  for (let i = 0; i < headerSlugs.length; i++) {
    const s = headerSlugs[i];
    if (s && PROSPECT_EXTRA_SLUGS.has(s)) return true;
  }
  return false;
}

function hasPersonColumn(slugToIndex, headerSlugs) {
  if (pickIndexFromAliases(slugToIndex, HEADER_ALIASES.person) >= 0)
    return true;
  for (let i = 0; i < headerSlugs.length; i++) {
    const s = headerSlugs[i];
    if (s && PERSON_EXTRA_SLUGS.has(s)) return true;
    if (
      s &&
      s.includes("contact") &&
      s.includes("name") &&
      !s.includes("company")
    )
      return true;
    if (s && s.includes("full") && s.includes("name")) return true;
  }
  return false;
}

function hasEmailColumn(slugToIndex) {
  if (pickIndexFromAliases(slugToIndex, HEADER_ALIASES.email) >= 0)
    return true;
  if (pickIndexFromAliases(slugToIndex, HEADER_ALIASES.company_email) >= 0)
    return true;
  for (const key of slugToIndex.keys()) {
    if (key === "email" || key === "company_email" || key === "work_email")
      return true;
    if (
      key.includes("email") &&
      !key.includes("status") &&
      !key.includes("validator")
    )
      return true;
  }
  return false;
}

const HEADER_ALIASES = {
  prospect: [
    "prospect",
    "company",
    "company_name",
    "account",
    "organization",
    "org",
    "business_name",
    "account_name",
    "employer",
  ],
  person: [
    "person",
    "name",
    "contact",
    "full_name",
    "contact_name",
    "contact_person",
    "person_name",
  ],
  email: [
    "email",
    "e_mail",
    "work_email",
    "business_email",
    "email_address",
    "mail",
    "contact_email",
  ],
  company_email: ["company_email", "organization_email", "corporate_email"],
  phone: [
    "phone",
    "mobile",
    "telephone",
    "tel",
    "phone_number",
    "mobile_phone",
    "contact_phone",
    "cell",
    "person_phone",
  ],
  company_phone: [
    "company_phone",
    "org_phone",
    "business_phone",
    "main_phone",
    "office_phone",
  ],
  job_title: ["job_title", "title", "role", "position", "job"],
  linkedin_person: [
    "linkedin",
    "linkedin_url",
    "linkedin_person",
    "person_linkedin",
    "linkedin_profile",
    "linkedin_in",
  ],
  linkedin_company: [
    "linkedin_company",
    "company_linkedin",
    "linkedin_org",
  ],
  website: ["website", "web_site", "company_website", "url", "domain"],
  location: ["location", "address", "city_region", "geo"],
  pin: ["pin_zip", "pincode", "zip", "postal_code", "postal"],
  why: ["why_this_person", "why", "fit", "reason"],
  signals: ["signals", "keywords", "tags"],
  linkedin_headline: ["linkedin_headline", "headline"],
  about: ["about_snippet", "about", "summary", "bio"],
  total_experience_yrs: [
    "total_experience_yrs",
    "total_experience",
    "years_experience",
    "experience_years",
  ],
  education: ["education", "educations"],
  work_history: ["work_history", "experience", "experiences"],
  skills: ["skills", "skill_set"],
  company_dossier: ["company_dossier", "dossier", "company_profile"],
  score: ["score", "fit_score", "display_score"],
  maps_rating: ["maps_rating", "map_rating"],
  maps_reviews: ["maps_reviews", "map_reviews", "reviews_count"],
  primary_source: ["primary_source", "source"],
};

/**
 * @param {string[]} headers
 * @returns {{ slugToIndex: Map<string, number>, headerSlugs: string[] }}
 */
function indexHeaders(headers) {
  const slugToIndex = new Map();
  const headerSlugs = headers.map((h) => slugHeader(h));
  headerSlugs.forEach((slug, i) => {
    if (!slug) return;
    if (!slugToIndex.has(slug)) slugToIndex.set(slug, i);
  });
  return { slugToIndex, headerSlugs };
}

function pickIndexFromAliases(slugToIndex, aliases) {
  for (const a of aliases) {
    if (slugToIndex.has(a)) return slugToIndex.get(a);
  }
  return -1;
}

/**
 * Resolve semantic column indices; supports reordered / renamed export-style headers.
 */
export function buildColumnIndexMap(headers) {
  const { slugToIndex, headerSlugs } = indexHeaders(headers);
  const map = {};
  const missingGroups = [];

  if (!hasProspectColumn(slugToIndex, headerSlugs)) {
    missingGroups.push("prospect (or company / organization)");
  }
  if (!hasPersonColumn(slugToIndex, headerSlugs)) {
    missingGroups.push("person (or contact name)");
  }
  if (!hasEmailColumn(slugToIndex)) {
    missingGroups.push("email (person and/or company)");
  }

  const optionalKeys = Object.keys(HEADER_ALIASES).filter(
    (k) => !["prospect", "person", "email"].includes(k)
  );
  for (const field of optionalKeys) {
    const idx = pickIndexFromAliases(slugToIndex, HEADER_ALIASES[field]);
    if (idx >= 0) map[field] = idx;
  }

  const prospectIdx = pickIndexFromAliases(slugToIndex, HEADER_ALIASES.prospect);
  const personIdx = pickIndexFromAliases(slugToIndex, HEADER_ALIASES.person);
  const emailIdx = pickIndexFromAliases(slugToIndex, HEADER_ALIASES.email);
  const companyEmailIdx = pickIndexFromAliases(
    slugToIndex,
    HEADER_ALIASES.company_email
  );

  if (prospectIdx >= 0) map.prospect = prospectIdx;
  if (personIdx >= 0) map.person = personIdx;
  if (emailIdx >= 0) map.email = emailIdx;
  if (companyEmailIdx >= 0) map.company_email = companyEmailIdx;

  return {
    map,
    missingGroups,
    headerSlugs,
    slugToIndex,
  };
}

/**
 * @param {Buffer} buffer
 * @returns {{ headers: string[], rows: string[][] }}
 */
export function parseSpreadsheetBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  if (!wb.SheetNames?.length) {
    throw new Error("That file has no sheets.");
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false,
  });
  if (!Array.isArray(matrix) || matrix.length === 0) {
    throw new Error("That file is empty.");
  }
  const headers = matrix[0].map((c) => String(c ?? "").trim());
  const rows = matrix.slice(1).map((r) => {
    const arr = Array.isArray(r) ? r : [];
    return headers.map((_, i) => String(arr[i] ?? "").trim());
  });
  return { headers, rows };
}

function cellAt(row, idx) {
  if (idx == null || idx < 0) return "";
  return String(row[idx] ?? "").trim();
}

function isLooselyValidEmail(s) {
  const t = String(s).trim();
  if (t.length < 4 || /\s/.test(t) || !t.includes("@")) return false;
  const [local, domain] = t.split("@");
  return local.length > 0 && domain && domain.includes(".");
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    const t = String(v ?? "").trim();
    if (t) return t;
  }
  return "";
}

function parseOptionalNumber(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const n = Number.parseFloat(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Original header → trimmed cell value (full row shape for round-trips / LLM). */
function buildImportRowSnapshot(headers, row) {
  const snap = {};
  headers.forEach((h, i) => {
    const key = String(h ?? "").trim() || `column_${i}`;
    snap[key] = String(row[i] ?? "").trim();
  });
  return snap;
}

/**
 * @param {string[][]} rows
 * @param {string[]} headers
 * @param {Record<string, number>} colMap
 */
export function buildNormalizedImportRows(rows, headers, colMap) {
  const out = [];
  const rowErrors = [];

  const limit = Math.min(rows.length, MAX_DATA_ROWS);
  const sliced = rows.slice(0, limit);

  sliced.forEach((row, i) => {
    const importRow = buildImportRowSnapshot(headers, row);

    const prospect = cellAt(row, colMap.prospect);
    const person = cellAt(row, colMap.person);
    const emailPersonal = cellAt(row, colMap.email);
    const emailCompany = cellAt(row, colMap.company_email);
    const effectiveEmail = firstNonEmpty(emailPersonal, emailCompany);

    const phoneDirect = cellAt(row, colMap.phone);
    const phoneCompany = cellAt(row, colMap.company_phone);
    const effectivePhone = firstNonEmpty(phoneDirect, phoneCompany);

    const jobTitle =
      colMap.job_title != null ? cellAt(row, colMap.job_title) : "";

    const liPersonRaw =
      colMap.linkedin_person != null
        ? cellAt(row, colMap.linkedin_person)
        : "";
    const liCompanyRaw =
      colMap.linkedin_company != null
        ? cellAt(row, colMap.linkedin_company)
        : "";

    const personLiNorm = liPersonRaw
      ? normalizeLinkedinUrl(liPersonRaw) || ""
      : "";
    const companyLiNorm = liCompanyRaw
      ? normalizeLinkedinUrl(liCompanyRaw) || ""
      : "";

    const website = colMap.website != null ? cellAt(row, colMap.website) : "";
    const location =
      colMap.location != null ? cellAt(row, colMap.location) : "";
    const pin = colMap.pin != null ? cellAt(row, colMap.pin) : "";
    const why = colMap.why != null ? cellAt(row, colMap.why) : "";
    const signals =
      colMap.signals != null ? cellAt(row, colMap.signals) : "";
    const linkedinHeadline =
      colMap.linkedin_headline != null
        ? cellAt(row, colMap.linkedin_headline)
        : "";
    const about =
      colMap.about != null ? cellAt(row, colMap.about) : "";
    const totalExp =
      colMap.total_experience_yrs != null
        ? cellAt(row, colMap.total_experience_yrs)
        : "";
    const education =
      colMap.education != null ? cellAt(row, colMap.education) : "";
    const workHistory =
      colMap.work_history != null ? cellAt(row, colMap.work_history) : "";
    const skills = colMap.skills != null ? cellAt(row, colMap.skills) : "";
    const companyDossier =
      colMap.company_dossier != null
        ? cellAt(row, colMap.company_dossier)
        : "";

    const scoreRaw = colMap.score != null ? cellAt(row, colMap.score) : "";
    const mapsRatingRaw =
      colMap.maps_rating != null ? cellAt(row, colMap.maps_rating) : "";
    const mapsReviewsRaw =
      colMap.maps_reviews != null ? cellAt(row, colMap.maps_reviews) : "";

    if (!prospect && !person && !effectiveEmail && !effectivePhone) return;

    const line = i + 2;
    if (!prospect || !person) {
      rowErrors.push(
        `Row ${line}: prospect (company) and person (name) are required when a row has data.`
      );
      return;
    }
    if (!effectiveEmail) {
      rowErrors.push(
        `Row ${line}: at least one email column (person or company) must be filled.`
      );
      return;
    }
    if (!isLooselyValidEmail(effectiveEmail)) {
      rowErrors.push(
        `Row ${line}: "${effectiveEmail}" does not look like a valid email.`
      );
      return;
    }

    const displayScore = parseOptionalNumber(scoreRaw);
    const mapsRating = parseOptionalNumber(mapsRatingRaw);
    const mapsReviews = parseOptionalNumber(mapsReviewsRaw);
    const totalExpNum = parseOptionalNumber(totalExp);

    out.push({
      prospect,
      person,
      email: effectiveEmail,
      personalEmail: emailPersonal || "",
      companyEmailForLead: emailCompany || "",
      phone: effectivePhone,
      phonePerson: phoneDirect,
      phoneCompany: phoneCompany,
      jobTitle,
      personLinkedInUrl:
        linkedinDestinationKind(personLiNorm) === "person"
          ? personLiNorm
          : "",
      companyLinkedInUrl:
        linkedinDestinationKind(companyLiNorm) === "company"
          ? companyLiNorm
          : "",
      website,
      location,
      pin,
      why,
      signals,
      linkedinHeadline,
      about,
      totalExperienceYears: totalExpNum,
      education,
      workHistory,
      skills,
      companyDossier,
      displayScoreOverride: displayScore,
      mapsRating,
      mapsReviews,
      importRow: importRow,
    });
  });

  return { rows: out, rowErrors };
}

function prospectDocsFromNormalized(userOid, campaignOid, normalized) {
  return normalized.map((r) => {
    const hasLi = Boolean(r.personLinkedInUrl);
    const { displayScore: dsBase, discoveryScore: discBase } =
      computeLeadBaselineScores(hasLi);
    const displayScore =
      typeof r.displayScoreOverride === "number" &&
      r.displayScoreOverride >= 0 &&
      r.displayScoreOverride <= 100
        ? Math.round(r.displayScoreOverride)
        : dsBase;

    const lead = {
      imported: true,
      importRow: r.importRow,
      company: r.prospect,
      full_name: r.person,
      title: r.jobTitle || "",
      email: r.email,
      phone: r.phonePerson || "",
      company_email: r.companyEmailForLead || "",
      company_phone: r.phoneCompany || "",
      headline: r.linkedinHeadline || r.why || "",
      keywords: r.signals || "",
      company_description: r.companyDossier || "",
      about: r.about || "",
      educations: r.education || "",
      experiences: r.workHistory || "",
      skills: r.skills || "",
      company_full_address: [r.location, r.pin].filter(Boolean).join(" "),
      company_website: r.website || "",
      linkedin: r.personLinkedInUrl || "",
      company_linkedin: r.companyLinkedInUrl || "",
      total_experience_years:
        r.totalExperienceYears != null ? r.totalExperienceYears : undefined,
    };

    const doc = {
      user: userOid,
      campaign: campaignOid,
      primarySource: "manual",
      sources: ["manual"],
      leadScraper: lead,
      displayName: r.person,
      companyName: r.prospect,
      email: r.email,
      personalEmail: r.personalEmail || "",
      mobilePhone: r.phone || "",
      jobTitle: r.jobTitle || "",
      companyWebsite: r.website || "",
      personLinkedInUrl: r.personLinkedInUrl || "",
      companyLinkedInUrl: r.companyLinkedInUrl || "",
      displayScore,
      discoveryScore: discBase,
      enrichment: {
        linkedinProfileStatus: "idle",
        linkedinCompanyStatus: "idle",
      },
    };

    if (r.location) {
      doc.city = r.location;
    }
    if (typeof r.mapsRating === "number") {
      doc.mapsRating = r.mapsRating;
    }
    if (typeof r.mapsReviews === "number") {
      doc.mapsReviewsCount = r.mapsReviews;
    }

    return doc;
  });
}

/**
 * Replace prospects for an import-mode campaign with rows from a spreadsheet buffer.
 */
export async function importAccountBookSpreadsheetForCampaign({
  campaignIdStr,
  userIdStr,
  buffer,
  fileLabel,
}) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error("Invalid file payload.");
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error("File is too large (max 8 MB).");
  }

  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(campaignIdStr)) {
    throw new Error("Invalid campaign id.");
  }

  const campaignDoc = await Campaign.findOne({
    _id: campaignIdStr,
    user: userIdStr,
  });

  if (!campaignDoc) {
    throw new Error("Campaign not found.");
  }

  if (campaignDoc.accountBookOrigin !== "import") {
    throw new Error("This campaign is not configured for spreadsheet import.");
  }

  const userOid = campaignDoc.user;
  const campaignOid = campaignDoc._id;

  const started = new Date();
  await Campaign.updateOne(
    { _id: campaignOid },
    {
      $set: {
        accountBookBuildStatus: "running",
        accountBookBuildError: "",
        accountBookStepLabel: "Reading your spreadsheet…",
        accountBookBuildStartedAt: started,
        accountBookBuildFinishedAt: null,
      },
    }
  );

  try {
    const { headers, rows } = parseSpreadsheetBuffer(buffer);
    const { map: colMap, missingGroups } = buildColumnIndexMap(headers);

    if (missingGroups.length) {
      const hint =
        "Include columns for company (prospect), contact name (person), and email. Person phone can be empty if company phone is present.";
      throw new Error(
        `Missing required column(s): ${missingGroups.join("; ")}. ${hint}`
      );
    }

    const { rows: normalized, rowErrors } = buildNormalizedImportRows(
      rows,
      headers,
      colMap
    );

    if (rowErrors.length) {
      const sample = rowErrors.slice(0, 6).join(" ");
      const more =
        rowErrors.length > 6 ? ` (+${rowErrors.length - 6} more issues)` : "";
      throw new Error(`${sample}${more}`);
    }

    if (normalized.length === 0) {
      throw new Error(
        "No data rows found. Add at least one row with prospect, person, and a valid email."
      );
    }

    await Campaign.updateOne(
      { _id: campaignOid },
      { $set: { accountBookStepLabel: "Saving prospects…" } }
    );

    await Prospect.deleteMany({ campaign: campaignOid, user: userOid });

    const docs = prospectDocsFromNormalized(userOid, campaignOid, normalized);
    for (let i = 0; i < docs.length; i += INSERT_CHUNK) {
      const slice = docs.slice(i, i + INSERT_CHUNK);
      await Prospect.insertMany(slice, { ordered: false });
    }

    const labelBase = fileLabel?.trim() || "spreadsheet";
    const shortLabel =
      labelBase.length > 80 ? `${labelBase.slice(0, 77)}…` : labelBase;

    await Campaign.updateOne(
      { _id: campaignOid },
      {
        $set: {
          accountBookBuildStatus: "complete",
          accountBookBuildError: "",
          accountBookStepLabel: `Imported ${normalized.length} row(s) from ${shortLabel}.`,
          accountBookProspectCount: normalized.length,
          accountBookBuildFinishedAt: new Date(),
        },
      }
    );

    return { prospectCount: normalized.length };
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 900);
    await Campaign.updateOne(
      { _id: campaignOid },
      {
        $set: {
          accountBookBuildStatus: "failed",
          accountBookBuildError: msg,
          accountBookStepLabel:
            "Import did not finish — fix the file and try creating again.",
          accountBookBuildFinishedAt: new Date(),
        },
      }
    );
    throw err;
  }
}
