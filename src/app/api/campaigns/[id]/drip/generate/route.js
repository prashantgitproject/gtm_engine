import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/libs/db";
import { Campaign } from "@/models/Campaign";
import { Prospect } from "@/models/Prospect";
import { buildProspectTableRow } from "@/libs/prospectTableRow";
import {
  campaignBriefForDripPrompt,
  createOpenAIClient,
  dripModelName,
  generateDripSequencesForChunk,
  prospectBriefForDripPrompt,
} from "@/libs/dripCampaignLlm";
import { getMongoUserFromSession } from "@/libs/mongoUser";

export const maxDuration = 300;

const CHUNK_SIZE = 4;

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

    const openai = createOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 503 }
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
        { error: "Wait for the account book to finish before generating a drip." },
        { status: 409 }
      );
    }

    if (campaign.dripCampaignStatus === "generating") {
      return NextResponse.json(
        { error: "Drip generation is already in progress." },
        { status: 409 }
      );
    }

    const prospects = await Prospect.find({ campaign: id, user: user._id })
      .sort({ discoveryScore: -1, updatedAt: -1 })
      .lean();

    if (prospects.length === 0) {
      return NextResponse.json(
        { error: "Add prospects to the account book first." },
        { status: 400 }
      );
    }

    await Campaign.updateOne(
      { _id: id, user: user._id },
      {
        $set: {
          dripCampaignStatus: "generating",
          dripCampaignError: "",
        },
      }
    );

    const signals = Array.isArray(campaign.signals) ? campaign.signals : [];
    const rows = prospects.map((p) => buildProspectTableRow(p, signals));
    const campaignBrief = campaignBriefForDripPrompt(campaign);
    const model = dripModelName();
    const now = new Date();

    try {
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const slice = rows.slice(i, i + CHUNK_SIZE);
        const chunkBriefs = slice.map(prospectBriefForDripPrompt);
        const map = await generateDripSequencesForChunk(
          openai,
          model,
          campaignBrief,
          chunkBriefs
        );

        for (const row of slice) {
          let sequence = map.get(row._id);
          if (!sequence || sequence.length < 3) {
            const retry = await generateDripSequencesForChunk(
              openai,
              model,
              campaignBrief,
              [prospectBriefForDripPrompt(row)]
            );
            sequence = retry.get(row._id);
          }
          if (!sequence || sequence.length < 3) {
            throw new Error(
              `Model did not return a valid sequence for prospect ${row._id}`
            );
          }

          await Prospect.updateOne(
            { _id: row._id, campaign: id, user: user._id },
            {
              $set: {
                dripSequence: sequence,
                dripGeneratedAt: now,
              },
            }
          );
        }
      }

      await Campaign.updateOne(
        { _id: id, user: user._id },
        {
          $set: {
            dripCampaignStatus: "complete",
            dripCampaignError: "",
            dripCampaignGeneratedAt: now,
          },
        }
      );

      return NextResponse.json({
        ok: true,
        prospectCount: rows.length,
        generatedAt: now.toISOString(),
      });
    } catch (err) {
      const msg =
        err && typeof err.message === "string"
          ? err.message.slice(0, 500)
          : "Drip generation failed";
      console.error(err);
      await Campaign.updateOne(
        { _id: id, user: user._id },
        {
          $set: {
            dripCampaignStatus: "failed",
            dripCampaignError: msg,
          },
        }
      );
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
