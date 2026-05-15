import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/libs/db";
import { Campaign } from "@/models/Campaign";
import { Prospect } from "@/models/Prospect";
import { getMongoUserFromSession } from "@/libs/mongoUser";
import { refreshCampaignOutreachStats } from "@/libs/campaignOutreachStats";

export async function POST(_request, { params }) {
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

    const campaign = await Campaign.findOne({ _id: id, user: user._id });
    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (campaign.status !== "running") {
      return NextResponse.json(
        { error: "Only running campaigns can be paused." },
        { status: 409 }
      );
    }

    campaign.status = "paused";
    await campaign.save();

    await Prospect.updateMany(
      { campaign: id, user: user._id, outreachStatus: "enrolled" },
      { $set: { outreachStatus: "paused" } }
    );

    const stats = await refreshCampaignOutreachStats(id, user._id);

    return NextResponse.json({ ok: true, outreachStats: stats });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
