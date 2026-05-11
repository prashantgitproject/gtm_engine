import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/libs/db";
import { Campaign } from "@/models/Campaign";
import { Prospect } from "@/models/Prospect";
import { buildProspectTableRow } from "@/libs/prospectTableRow";
import { getMongoUserFromSession } from "@/libs/mongoUser";

/** Account book UI: lead scraper first, Google Maps second, then other origins. */
function accountBookSourceRank(primarySource) {
  if (primarySource === "lead_scraper") return 0;
  if (primarySource === "google_maps") return 1;
  return 2;
}

function sortProspectsForAccountBook(a, b) {
  const ra = accountBookSourceRank(a.primarySource);
  const rb = accountBookSourceRank(b.primarySource);
  if (ra !== rb) return ra - rb;
  const dsA = typeof a.discoveryScore === "number" ? a.discoveryScore : 0;
  const dsB = typeof b.discoveryScore === "number" ? b.discoveryScore : 0;
  if (dsB !== dsA) return dsB - dsA;
  const uA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const uB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  return uB - uA;
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

    const prospects = await Prospect.find({ campaign: id, user: user._id }).lean();
    prospects.sort(sortProspectsForAccountBook);

    const signals = Array.isArray(campaign.signals) ? campaign.signals : [];
    const rows = prospects.map((p) => buildProspectTableRow(p, signals));
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
        dripCampaignStatus: campaign.dripCampaignStatus || "idle",
        dripCampaignError: campaign.dripCampaignError || "",
        dripCampaignGeneratedAt: campaign.dripCampaignGeneratedAt
          ? new Date(campaign.dripCampaignGeneratedAt).toISOString()
          : null,
      },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
