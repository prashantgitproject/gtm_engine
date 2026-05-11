const { Schema, models, model } = require("mongoose");

/**
 * One row per scraped lead/place/contact for a campaign. Raw actor payloads stay
 * in Mixed fields so shape can evolve; root fields mirror common keys for querying.
 *
 * Typical flow: lead_scraper fills `linkedin` URL → enrichment runs LinkedIn profile
 * and/or LinkedIn company actor and merges into `linkedinProfile` / `linkedinCompany`.
 */
const prospectSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    campaign: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },

    primarySource: {
      type: String,
      enum: [
        "lead_scraper",
        "google_maps",
        "linkedin_profile",
        "linkedin_company",
        "manual",
      ],
      required: true,
      index: true,
    },

    /** Which layers exist on this document (additive). */
    sources: [{ type: String, trim: true }],

    leadScraper: { type: Schema.Types.Mixed },
    googleMaps: { type: Schema.Types.Mixed },
    linkedinProfile: { type: Schema.Types.Mixed },
    linkedinCompany: { type: Schema.Types.Mixed },

    /** Denormalized from merged payloads — query / UI */
    displayName: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, default: "" },
    personalEmail: { type: String, trim: true, default: "" },
    mobilePhone: { type: String, trim: true, default: "" },
    jobTitle: { type: String, trim: true, default: "" },
    companyName: { type: String, trim: true, default: "" },
    companyWebsite: { type: String, trim: true, default: "" },
    companyDomain: { type: String, trim: true, lowercase: true, default: "" },
    city: { type: String, trim: true, default: "" },
    stateRegion: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    googleMapsPlaceUrl: { type: String, trim: true, default: "" },
    personLinkedInUrl: { type: String, trim: true, default: "" },
    companyLinkedInUrl: { type: String, trim: true, default: "" },
    companyLinkedInUid: { type: String, trim: true, default: "" },

    /** Account book sort (higher = surfaced first). Derived from Maps rating/reviews or baseline + enrich. */
    discoveryScore: { type: Number, default: 0 },
    /** Human-facing 0–100 score for the table badge */
    displayScore: { type: Number, default: 55 },
    mapsRating: { type: Number },
    mapsReviewsCount: { type: Number },

    enrichment: {
      linkedinProfileStatus: {
        type: String,
        enum: ["idle", "pending", "done", "failed", "skipped"],
        default: "idle",
      },
      linkedinProfileFetchedAt: { type: Date },
      linkedinCompanyStatus: {
        type: String,
        enum: ["idle", "pending", "done", "failed", "skipped"],
        default: "idle",
      },
      linkedinCompanyFetchedAt: { type: Date },
    },
  },
  { timestamps: true }
);

prospectSchema.index({ campaign: 1, discoveryScore: -1 });
prospectSchema.index({ campaign: 1, displayScore: -1 });
prospectSchema.index({ campaign: 1, user: 1 });
prospectSchema.index(
  { campaign: 1, personLinkedInUrl: 1 },
  { sparse: true, partialFilterExpression: { personLinkedInUrl: { $exists: true, $ne: "" } } }
);
prospectSchema.index(
  { campaign: 1, googleMapsPlaceUrl: 1 },
  { sparse: true, partialFilterExpression: { googleMapsPlaceUrl: { $exists: true, $ne: "" } } }
);
prospectSchema.index(
  { campaign: 1, email: 1 },
  { sparse: true, partialFilterExpression: { email: { $exists: true, $ne: "" } } }
);
prospectSchema.index(
  { campaign: 1, companyLinkedInUid: 1 },
  {
    sparse: true,
    partialFilterExpression: { companyLinkedInUid: { $exists: true, $ne: "" } },
  }
);

export const Prospect =
  models.Prospect || model("Prospect", prospectSchema, "prospects");
