import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/libs/db";
import { Campaign } from "@/models/Campaign";
import { getMongoUserFromSession } from "@/libs/mongoUser";
import { launchCampaignOutreach, validateLaunchChannels } from "@/libs/dripLaunch";

export async function POST(request, { params }) {
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

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const channels = Array.isArray(body.channels) ? body.channels : [];
    const channelErrors = await validateLaunchChannels(user, channels);
    if (channelErrors.length) {
      return NextResponse.json(
        { error: channelErrors.join(" "), channelErrors },
        { status: 400 }
      );
    }

    await connectDB();

    const campaign = await Campaign.findOne({
      _id: id,
      user: user._id,
    }).lean();

    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (campaign.accountBookBuildStatus === "running") {
      return NextResponse.json(
        { error: "Wait for the account book to finish before launching." },
        { status: 409 }
      );
    }

    const result = await launchCampaignOutreach({
      campaignId: id,
      userId: user._id,
      channels,
      deliveryHour: body.deliveryHour,
      timezone: body.timezone,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e?.message || "Could not launch campaign";
    const status = msg.includes("not found") ? 404 : 400;
    console.error(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
