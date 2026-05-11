import { NextResponse } from "next/server";
import { getMongoUserFromSession } from "@/libs/mongoUser";
import { Campaign } from "@/models/Campaign";
import { normalizeSourcingProfile } from "@/libs/sourcingProfile";

function parseSignals(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  return String(raw)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET() {
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

    const campaigns = await Campaign.find({ user: user._id })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json(
      campaigns.map((c) => ({
        ...c,
        _id: String(c._id),
        user: String(c.user),
      })),
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request) {
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

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const signals = parseSignals(body.signals);

    const rawSp = body.sourcingProfile;
    const userFileName =
      rawSp &&
      typeof rawSp.file_name === "string" &&
      rawSp.file_name.trim();

    const sourcingProfile = normalizeSourcingProfile(body.sourcingProfile);
    if (!userFileName) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 80);
      if (slug) sourcingProfile.file_name = slug;
    }

    const doc = await Campaign.create({
      user: user._id,
      name,
      goal,
      description,
      signals,
      sourcingProfile,
      status: "draft",
      results: { sends: 0, replies: 0, meetingsBooked: 0 },
    });

    return NextResponse.json(
      {
        ...doc.toObject(),
        _id: String(doc._id),
        user: String(doc.user),
      },
      { status: 201 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
