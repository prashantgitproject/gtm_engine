import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/libs/db";
import { Campaign } from "@/models/Campaign";
import { Prospect } from "@/models/Prospect";
import { truncateText } from "@/libs/linkedinUrls";
import { getMongoUserFromSession } from "@/libs/mongoUser";

function trimStr(v) {
  if (v == null || v === "") return "";
  return String(v).trim();
}

function dashOr(val) {
  const s = trimStr(val);
  return s ? s : "—";
}

function phoneForRow(p, maps) {
  return (
    trimStr(p.mobilePhone) ||
    trimStr(maps.phone) ||
    trimStr(maps.phoneUnformatted) ||
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

function locationForRow(p, maps) {
  const addr = trimStr(maps.address);
  if (addr) return addr;
  const city = trimStr(p.city) || trimStr(maps.city);
  const state = trimStr(p.stateRegion) || trimStr(maps.state);
  const country = trimStr(p.country) || trimStr(maps.countryCode);
  const parts = [city, state, country].filter(Boolean);
  return parts.join(", ");
}

function pincodeForRow(maps) {
  return trimStr(maps.postalCode) || "";
}

function rowFromProspect(p, campaignSignals) {
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

  const emailRaw =
    trimStr(p.email) || trimStr(p.personalEmail) || "";

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
    website: dashOr(websiteForRow(p, lc, maps)),
    linkedinUrls: linkedinUrlsForRow(p),
    location: dashOr(locationForRow(p, maps)),
    pincode: dashOr(pincodeForRow(maps)),
    why,
    signals: signals.length ? signals : [],
    score: typeof p.displayScore === "number" ? p.displayScore : 55,
    mapsRating:
      typeof p.mapsRating === "number" ? p.mapsRating : null,
    mapsReviewsCount:
      typeof p.mapsReviewsCount === "number" ? p.mapsReviewsCount : null,
    primarySource: p.primarySource,
    discoveryScore: typeof p.discoveryScore === "number" ? p.discoveryScore : 0,
  };
}

export async function GET(_request, { params }) {
  try {
    const user = await getMongoUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.payment !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
    }

    await connectDB();

    const campaign = await Campaign.findOne({
      _id: id,
      user: user._id,
    }).lean();

    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const prospects = await Prospect.find({ campaign: id, user: user._id })
      .sort({ discoveryScore: -1, updatedAt: -1 })
      .lean();

    const signals = Array.isArray(campaign.signals) ? campaign.signals : [];
    const rows = prospects.map((p) => rowFromProspect(p, signals));
    const avgScore =
      rows.length > 0
        ? Math.round(
            rows.reduce((acc, r) => acc + (r.score || 0), 0) / rows.length
          )
        : null;

    return NextResponse.json(
      {
        prospects: rows,
        avgScore,
        count: rows.length,
        buildStatus: campaign.accountBookBuildStatus || "idle",
        buildStepLabel: campaign.accountBookStepLabel || "",
        buildError: campaign.accountBookBuildError || "",
      },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
