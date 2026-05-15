import { Campaign } from "@/models/Campaign";
import { Prospect } from "@/models/Prospect";

const CHANNELS = ["email", "linkedin", "whatsapp"];

function emptyByChannel() {
  return {
    email: { sent: 0, failed: 0, scheduled: 0, skipped: 0 },
    linkedin: { sent: 0, failed: 0, scheduled: 0, skipped: 0 },
    whatsapp: { sent: 0, failed: 0, scheduled: 0, skipped: 0 },
  };
}

/**
 * Aggregate step delivery counts for a campaign from all prospects.
 * @param {string} campaignId
 */
export async function computeCampaignOutreachStats(campaignId) {
  const prospects = await Prospect.find({ campaign: campaignId })
    .select("dripSequence outreachStatus")
    .lean();

  const stats = {
    totalSteps: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    scheduled: 0,
    pending: 0,
    prospectsEnrolled: 0,
    prospectsCompleted: 0,
    byChannel: emptyByChannel(),
  };

  for (const p of prospects) {
    if (p.outreachStatus === "enrolled") stats.prospectsEnrolled += 1;
    if (p.outreachStatus === "completed") stats.prospectsCompleted += 1;

    const seq = Array.isArray(p.dripSequence) ? p.dripSequence : [];
    for (const step of seq) {
      stats.totalSteps += 1;
      const ch = String(step.channel || "").toLowerCase();
      const status = String(step.deliveryStatus || "pending");

      if (status === "sent") stats.sent += 1;
      else if (status === "failed") stats.failed += 1;
      else if (status === "skipped") stats.skipped += 1;
      else if (status === "scheduled") stats.scheduled += 1;
      else stats.pending += 1;

      if (CHANNELS.includes(ch) && stats.byChannel[ch]) {
        if (status === "sent") stats.byChannel[ch].sent += 1;
        else if (status === "failed") stats.byChannel[ch].failed += 1;
        else if (status === "skipped") stats.byChannel[ch].skipped += 1;
        else if (status === "scheduled") stats.byChannel[ch].scheduled += 1;
      }
    }
  }

  return stats;
}

/**
 * @param {string} campaignId
 * @param {string} userId
 */
export async function refreshCampaignOutreachStats(campaignId, userId) {
  const stats = await computeCampaignOutreachStats(campaignId);
  stats.lastProcessedAt = new Date();

  await Campaign.updateOne(
    { _id: campaignId, user: userId },
    {
      $set: {
        outreachStats: stats,
        "results.sends": stats.sent,
      },
    }
  );

  const campaign = await Campaign.findById(campaignId).select("outreachStats status").lean();
  const allDone =
    stats.prospectsEnrolled > 0 &&
    stats.scheduled === 0 &&
    stats.pending === 0 &&
    stats.sent + stats.failed + stats.skipped >= stats.totalSteps;

  if (campaign?.status === "running" && allDone && stats.totalSteps > 0) {
    await Campaign.updateOne(
      { _id: campaignId, user: userId },
      { $set: { status: "completed" } }
    );
  }

  return stats;
}

/**
 * Mark prospect completed when no scheduled steps remain.
 */
export async function maybeCompleteProspectOutreach(prospectId) {
  const p = await Prospect.findById(prospectId).select("dripSequence outreachStatus campaign").lean();
  if (!p || p.outreachStatus !== "enrolled") return;

  const seq = Array.isArray(p.dripSequence) ? p.dripSequence : [];
  const hasQueued = seq.some((s) => {
    const st = String(s.deliveryStatus || "");
    return st === "scheduled" || st === "pending";
  });

  if (!hasQueued) {
    await Prospect.updateOne(
      { _id: prospectId },
      { $set: { outreachStatus: "completed" } }
    );
  }
}
