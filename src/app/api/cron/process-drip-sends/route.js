import { NextResponse } from "next/server";
import { connectDB } from "@/libs/db";
import { processDueDripSends } from "@/libs/dripOutreachExecutor";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorizeCron(request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const header = request.headers.get("x-cron-secret");
  if (header === secret) return true;

  return false;
}

export async function GET(request) {
  return runCron(request);
}

export async function POST(request) {
  return runCron(request);
}

async function runCron(request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const result = await processDueDripSends();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message || "Cron failed" },
      { status: 500 }
    );
  }
}
