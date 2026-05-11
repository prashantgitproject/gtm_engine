import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/libs/db";
import { Campaign } from "@/models/Campaign";
import { Prospect } from "@/models/Prospect";
import { normalizeDripSequence } from "@/libs/dripCampaignLlm";
import { getMongoUserFromSession } from "@/libs/mongoUser";

export async function PATCH(request, { params }) {
  try {
    const user = await getMongoUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.payment !== true) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, prospectId } = params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
    }
    if (!prospectId || !mongoose.Types.ObjectId.isValid(prospectId)) {
      return NextResponse.json({ error: "Invalid prospect id" }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const sequence = normalizeDripSequence(body?.sequence);
    if (sequence.length === 0) {
      return NextResponse.json(
        { error: "sequence must be a non-empty array of valid steps" },
        { status: 400 }
      );
    }

    await connectDB();

    const owns = await Campaign.findOne({
      _id: id,
      user: user._id,
    })
      .select("_id dripCampaignStatus")
      .lean();

    if (!owns) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (owns.dripCampaignStatus !== "complete") {
      return NextResponse.json(
        { error: "Create a drip campaign before editing sequences." },
        { status: 409 }
      );
    }

    const res = await Prospect.updateOne(
      {
        _id: prospectId,
        campaign: id,
        user: user._id,
      },
      {
        $set: {
          dripSequence: sequence,
          dripGeneratedAt: new Date(),
        },
      }
    );

    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, sequence });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
