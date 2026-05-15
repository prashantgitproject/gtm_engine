const { Schema, models, model } = require("mongoose");

const sourcingProfileSchema = new Schema(
  {
    contact_location: { type: [String], default: [] },
    contact_state: { type: [String], default: [] },
    contact_city: { type: [String], default: [] },
    contact_not_city: { type: [String], default: [] },
    contact_not_location: { type: [String], default: [] },
    company_domain: { type: [String], default: [] },
    company_industry: { type: [String], default: [] },
    company_keywords: { type: [String], default: [] },
    company_not_keywords: { type: [String], default: [] },
    contact_job_title: { type: [String], default: [] },
    email_status: { type: [String], default: ["validated"] },
    fetch_count: { type: Number, default: 10 },
    file_name: { type: String, default: "prospects" },
    functional_level: { type: [String], default: [] },
    funding: { type: [String], default: [] },
    max_revenue: { type: String, default: "" },
    min_revenue: { type: String, default: "" },
    seniority_level: { type: [String], default: [] },
    size: { type: [String], default: [] },
    linkedin_profile_urls: { type: [String], default: [] },
    linkedin_company_profile_urls: { type: [String], default: [] },
    maps_location_query: { type: String, default: "" },
    maps_search_strings: { type: [String], default: [] },
    maps_max_crawled_places_per_search: { type: Number, default: 0 },
    maps_max_reviews: { type: Number, default: 0 },
    maps_language: { type: String, default: "en" },
    maps_include_web_results: { type: Boolean, default: false },
  },
  { _id: false }
);

const campaignSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    goal: {
      type: String,
      trim: true,
      default: "",
    },
    signals: [
      {
        type: String,
        trim: true,
      },
    ],
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "paused", "running", "completed"],
      default: "draft",
    },
    results: {
      sends: { type: Number, default: 0, min: 0 },
      replies: { type: Number, default: 0, min: 0 },
      meetingsBooked: { type: Number, default: 0, min: 0 },
    },

    /**
     * scrape: built via Apify lead/maps/LinkedIn pipeline.
     * import: rows loaded from user spreadsheet (no automated scrape rebuild).
     */
    accountBookOrigin: {
      type: String,
      enum: ["scrape", "import"],
      default: "scrape",
    },

    /** Background account-book (prospect) enrichment */
    accountBookBuildStatus: {
      type: String,
      enum: ["idle", "running", "complete", "failed"],
      default: "idle",
    },
    accountBookStepLabel: { type: String, default: "" },
    accountBookBuildError: { type: String, default: "" },
    accountBookProspectCount: { type: Number, default: 0 },
    accountBookBuildStartedAt: { type: Date },
    accountBookBuildFinishedAt: { type: Date },
    sourcingProfile: {
      type: sourcingProfileSchema,
      default: undefined,
    },

    /** LLM-generated multi-channel drip (per-prospect content lives on Prospect) */
    dripCampaignStatus: {
      type: String,
      enum: ["idle", "generating", "complete", "failed"],
      default: "idle",
    },
    dripCampaignError: { type: String, default: "" },
    dripCampaignGeneratedAt: { type: Date },

    /** Active outreach after launch */
    launchChannels: {
      type: [{ type: String, enum: ["email", "linkedin", "whatsapp"] }],
      default: [],
    },
    launchDeliveryHour: { type: Number, default: 11, min: 0, max: 23 },
    launchTimezone: { type: String, default: "UTC" },
    launchedAt: { type: Date },
    outreachStats: {
      totalSteps: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      scheduled: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
      prospectsEnrolled: { type: Number, default: 0 },
      prospectsCompleted: { type: Number, default: 0 },
      byChannel: {
        email: {
          sent: { type: Number, default: 0 },
          failed: { type: Number, default: 0 },
          scheduled: { type: Number, default: 0 },
          skipped: { type: Number, default: 0 },
        },
        linkedin: {
          sent: { type: Number, default: 0 },
          failed: { type: Number, default: 0 },
          scheduled: { type: Number, default: 0 },
          skipped: { type: Number, default: 0 },
        },
        whatsapp: {
          sent: { type: Number, default: 0 },
          failed: { type: Number, default: 0 },
          scheduled: { type: Number, default: 0 },
          skipped: { type: Number, default: 0 },
        },
      },
      lastProcessedAt: { type: Date },
    },
  },
  { timestamps: true }
);

export const Campaign = models.Campaign || model("Campaign", campaignSchema);
