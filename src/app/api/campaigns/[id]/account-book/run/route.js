import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { runAccountBookBuild } from "@/libs/accountBookOrchestrator";
import { connectDB } from "@/libs/db";
import { Campaign } from "@/models/Campaign";
import "@/models/Prospect";
import { getMongoUserFromSession } from "@/libs/mongoUser";

export const maxDuration = 900;

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

    const owns = await Campaign.exists({ _id: id, user: user._id });
    if (!owns) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const userId =
      user._id && typeof user._id.toString === "function"
        ? user._id.toString()
        : String(user._id);

    const result = await runAccountBookBuild(id, userId);

    if (result.skipped) {
      return NextResponse.json(
        { message: "Build already running", skipped: true },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      prospectCount: result.prospectCount,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message || "Account book build failed" },
      { status: 500 }
    );
  }
}
