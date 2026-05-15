import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { importAccountBookSpreadsheetForCampaign } from "@/libs/accountBookSpreadsheetImport";
import { getMongoUserFromSession } from "@/libs/mongoUser";

export const maxDuration = 120;

const ALLOWED_EXT = new Set(["csv", "xlsx", "xls", "ods"]);

function extFromName(name) {
  const m = String(name || "")
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

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

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: "Attach a CSV or Excel file (field name: file)." },
        { status: 400 }
      );
    }

    const name = typeof file.name === "string" ? file.name : "upload";
    const ext = extFromName(name);
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Use .csv, .xlsx, .xls, or .ods (first sheet is read).",
        },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());

    const userId =
      user._id && typeof user._id.toString === "function"
        ? user._id.toString()
        : String(user._id);

    const result = await importAccountBookSpreadsheetForCampaign({
      campaignIdStr: id,
      userIdStr: userId,
      buffer: buf,
      fileLabel: name,
    });

    return NextResponse.json(
      { ok: true, prospectCount: result.prospectCount },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message || "Import failed" },
      { status: 400 }
    );
  }
}
