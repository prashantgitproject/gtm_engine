import mongoose from "mongoose";
import { Campaign } from "@/models/Campaign";
import { Prospect } from "@/models/Prospect";
import { connectDB } from "@/libs/db";
import {
  runLeadScraperFromProfile,
  runGoogleMapsScraperFromProfile,
  runLinkedinProfileScraperForUrls,
  runLinkedinCompanyProfileScraperForUrls,
} from "@/libs/apifyCampaignActors";
import {
  bumpScoreAfterLinkedinMerge,
  computeLeadBaselineScores,
  computeMapsScores,
} from "@/libs/discoveryScore";
import {
  linkedinDestinationKind,
  normalizeLinkedinUrl,
  truncateText,
} from "@/libs/linkedinUrls";
import {
  fieldsFromLeadScraperRow,
  fieldsFromGoogleMapsRow,
  fieldsFromLinkedinProfileRow,
  fieldsFromLinkedinCompanyRow,
  mergeProspectFlatFields,
} from "@/libs/prospectPayloadMap";

const STEP_MESSAGES = [
  "Tuning signals to your territory…",
  "Scanning public footprints for strong fits…",
  "Cross-checking people and places…",
  "Enriching standout records…",
  "Polishing your shortlist…",
];

async function bumpCampaignStep(campaignId, label) {
  await Campaign.updateOne(
    { _id: campaignId },
    { $set: { accountBookStepLabel: label } }
  );
}

function firstDatasetItem(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[0];
}

function sourcingPlain(campaignDoc) {
  const sp = campaignDoc.sourcingProfile;
  if (!sp || typeof sp !== "object") return {};
  if (typeof sp.toObject === "function") return sp.toObject();
  return { ...sp };
}

/**
 * Build prospects for a campaign: parallel lead + Maps scrapes, then LinkedIn
 * profile/company enrichment when URLs exist on lead rows.
 */
export async function runAccountBookBuild(campaignIdStr, userIdStr) {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(campaignIdStr)) {
    throw new Error("Invalid campaign id");
  }

  const campaignDoc = await Campaign.findOne({
    _id: campaignIdStr,
    user: userIdStr,
  });

  if (!campaignDoc) {
    throw new Error("Campaign not found");
  }

  if (campaignDoc.accountBookBuildStatus === "running") {
    return { skipped: true, reason: "already_running" };
  }

  const effectiveSourcing = sourcingPlain(campaignDoc);

  campaignDoc.accountBookBuildStatus = "running";
  campaignDoc.accountBookStepLabel = STEP_MESSAGES[0];
  campaignDoc.accountBookBuildError = "";
  campaignDoc.accountBookBuildStartedAt = new Date();
  campaignDoc.accountBookBuildFinishedAt = null;
  await campaignDoc.save();

  const userOid = campaignDoc.user;
  const campaignOid = campaignDoc._id;

  try {
    await Prospect.deleteMany({ campaign: campaignOid, user: userOid });

    await bumpCampaignStep(campaignOid, STEP_MESSAGES[1]);

    const fetchCap = Math.min(
      Math.max(Number(effectiveSourcing.fetch_count) || 10, 1),
      500
    );

    const [leadRes, mapsRes] = await Promise.all([
      runLeadScraperFromProfile(effectiveSourcing, {
        limit: fetchCap,
      }),
      runGoogleMapsScraperFromProfile(effectiveSourcing, {
        limit: Math.min(
          fetchCap,
          Math.max(
            Number(effectiveSourcing.maps_max_crawled_places_per_search) || 50,
            1
          )
        ),
      }),
    ]);

    await bumpCampaignStep(campaignOid, STEP_MESSAGES[2]);

    const leadItems = Array.isArray(leadRes?.items) ? leadRes.items : [];
    const mapsItems = Array.isArray(mapsRes?.items) ? mapsRes.items : [];

    for (const item of mapsItems) {
      const { displayScore, discoveryScore, mapsRating, mapsReviewsCount } =
        computeMapsScores(item.totalScore, item.reviewsCount);
      const flat = mergeProspectFlatFields(
        {},
        [fieldsFromGoogleMapsRow(item)]
      );
      await Prospect.create({
        user: userOid,
        campaign: campaignOid,
        primarySource: "google_maps",
        sources: ["google_maps"],
        googleMaps: item,
        displayScore,
        discoveryScore,
        mapsRating,
        mapsReviewsCount,
        ...flat,
      });
    }

    await bumpCampaignStep(campaignOid, STEP_MESSAGES[3]);

    const savedLeadProspectIds = [];
    for (const item of leadItems) {
      const personUrlNorm = normalizeLinkedinUrl(item.linkedin);
      const { displayScore: ds0, discoveryScore: d0 } =
        computeLeadBaselineScores(Boolean(personUrlNorm));
      const flat = mergeProspectFlatFields({}, [fieldsFromLeadScraperRow(item)]);
      const doc = await Prospect.create({
        user: userOid,
        campaign: campaignOid,
        primarySource: "lead_scraper",
        sources: ["lead_scraper"],
        leadScraper: item,
        displayScore: ds0,
        discoveryScore: d0,
        ...flat,
      });
      savedLeadProspectIds.push(doc._id);
    }

    /** LinkedIn enrichment (sequential — easier on quotas and timeouts). */
    const leadProspects = await Prospect.find({
      _id: { $in: savedLeadProspectIds },
    });

    await bumpCampaignStep(campaignOid, STEP_MESSAGES[4]);

    for (const prospect of leadProspects) {
      const row = prospect.leadScraper || {};
      const patches = [];
      let linkedinCompanyDone = false;

      const personUrl = normalizeLinkedinUrl(row.linkedin || prospect.personLinkedInUrl);
      const companyUrlNorm = normalizeLinkedinUrl(row.company_linkedin || prospect.companyLinkedInUrl);

      if (personUrl && linkedinDestinationKind(personUrl) === "person") {
        prospect.enrichment.linkedinProfileStatus = "pending";
        try {
          const { items } = await runLinkedinProfileScraperForUrls([personUrl], {
            limit: 5,
          });
          const pr = firstDatasetItem(items);
          if (pr) {
            prospect.linkedinProfile = pr;
            prospect.sources = Array.from(
              new Set([...(prospect.sources || []), "linkedin_profile"])
            );
            patches.push(fieldsFromLinkedinProfileRow(pr));
            prospect.enrichment.linkedinProfileStatus = "done";
            prospect.enrichment.linkedinProfileFetchedAt = new Date();
          } else {
            prospect.enrichment.linkedinProfileStatus = "failed";
          }
        } catch {
          prospect.enrichment.linkedinProfileStatus = "failed";
        }
      } else if (personUrl && linkedinDestinationKind(personUrl) === "company") {
        prospect.enrichment.linkedinProfileStatus = "skipped";
        prospect.enrichment.linkedinCompanyStatus = "pending";
        try {
          const { items } = await runLinkedinCompanyProfileScraperForUrls([
            personUrl,
          ]);
          const co = firstDatasetItem(items);
          if (co) {
            prospect.linkedinCompany = co;
            prospect.sources = Array.from(
              new Set([...(prospect.sources || []), "linkedin_company"])
            );
            patches.push(fieldsFromLinkedinCompanyRow(co));
            prospect.enrichment.linkedinCompanyStatus = "done";
            prospect.enrichment.linkedinCompanyFetchedAt = new Date();
            linkedinCompanyDone = true;
          } else prospect.enrichment.linkedinCompanyStatus = "failed";
        } catch {
          prospect.enrichment.linkedinCompanyStatus = "failed";
        }
      } else if (personUrl) {
        prospect.enrichment.linkedinProfileStatus = "skipped";
      }

      const sameOrgUrl =
        personUrl &&
        companyUrlNorm &&
        personUrl.toLowerCase() === companyUrlNorm.toLowerCase();

      if (
        companyUrlNorm &&
        linkedinDestinationKind(companyUrlNorm) === "company" &&
        !linkedinCompanyDone &&
        !sameOrgUrl
      ) {
        prospect.enrichment.linkedinCompanyStatus = "pending";
        try {
          const { items } = await runLinkedinCompanyProfileScraperForUrls([
            companyUrlNorm,
          ]);
          const co = firstDatasetItem(items);
          if (co) {
            prospect.linkedinCompany = co;
            prospect.sources = Array.from(
              new Set([...(prospect.sources || []), "linkedin_company"])
            );
            patches.push(fieldsFromLinkedinCompanyRow(co));
            prospect.enrichment.linkedinCompanyStatus = "done";
            prospect.enrichment.linkedinCompanyFetchedAt = new Date();
          } else prospect.enrichment.linkedinCompanyStatus = "failed";
        } catch {
          prospect.enrichment.linkedinCompanyStatus = "failed";
        }
      }

      if (patches.length > 0) {
        const merged = mergeProspectFlatFields(
          {
            displayName: prospect.displayName,
            email: prospect.email,
            personalEmail: prospect.personalEmail,
            mobilePhone: prospect.mobilePhone,
            jobTitle: prospect.jobTitle,
            companyName: prospect.companyName,
            companyWebsite: prospect.companyWebsite,
            companyDomain: prospect.companyDomain,
            city: prospect.city,
            stateRegion: prospect.stateRegion,
            country: prospect.country,
            googleMapsPlaceUrl: prospect.googleMapsPlaceUrl,
            personLinkedInUrl: prospect.personLinkedInUrl,
            companyLinkedInUrl: prospect.companyLinkedInUrl,
            companyLinkedInUid: prospect.companyLinkedInUid,
          },
          patches
        );
        Object.assign(prospect, merged);
        const boost = bumpScoreAfterLinkedinMerge(
          prospect.displayScore,
          prospect.discoveryScore
        );
        prospect.displayScore = boost.displayScore;
        prospect.discoveryScore = boost.discoveryScore;
      }

      await prospect.save();
    }

    const prospectCount = await Prospect.countDocuments({
      campaign: campaignOid,
      user: userOid,
    });

    await Campaign.updateOne(
      { _id: campaignOid },
      {
        $set: {
          accountBookBuildStatus: "complete",
          accountBookBuildError: "",
          accountBookStepLabel: "All set — your workspace is warmed up.",
          accountBookProspectCount: prospectCount,
          accountBookBuildFinishedAt: new Date(),
        },
      }
    );

    return { ok: true, prospectCount };
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 750);
    await Campaign.updateOne(
      { _id: campaignOid },
      {
        $set: {
          accountBookBuildStatus: "failed",
          accountBookBuildError: msg,
          accountBookStepLabel: "Something stalled — open the campaign to retry.",
          accountBookBuildFinishedAt: new Date(),
        },
      }
    );
    throw err;
  }
}
