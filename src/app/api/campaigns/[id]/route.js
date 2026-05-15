import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/libs/db";
import { getMongoUserFromSession } from "@/libs/mongoUser";
import { Campaign } from "@/models/Campaign";

export async function GET(request, { params }) {
  try {
    const user = await getMongoUserFromSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.payment !== true) {
      return NextResponse.json(
        { error: "You do not have access to this premium feature" },
        { status: 403 }
      );
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

    return NextResponse.json(
      {
        ...campaign,
        _id: String(campaign._id),
        user: String(campaign.user),
      },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
