import { sendBrevoTransactionalEmail, outreachFromAddress } from "@/libs/brevoSend";
import { sendLinkedInMessageViaLinkup } from "@/libs/linkupApi";
import { sendWhatsAppTextMessage, normalizeE164Digits } from "@/libs/whatsappCloudApi";
import { getDecryptedWhatsappAccessToken } from "@/libs/whatsappCredentials";
import {
  maybeCompleteProspectOutreach,
  refreshCampaignOutreachStats,
} from "@/libs/campaignOutreachStats";
import { Prospect } from "@/models/Prospect";
import { Campaign } from "@/models/Campaign";
import { User } from "@/models/User";

const MAX_STEPS_PER_CRON_RUN = 40;

function prospectEmail(p) {
  const e = String(p.email || p.personalEmail || "").trim();
  return e && e.includes("@") ? e : "";
}

function prospectLinkedInUrl(p) {
  return String(p.personLinkedInUrl || "").trim();
}

function prospectPhone(p) {
  return normalizeE164Digits(p.mobilePhone || "");
}

/**
 * @param {{ user: object, campaign: object, prospect: object, step: object, stepIndex: number }} ctx
 */
async function sendDripStep(ctx) {
  const { user, campaign, prospect, step } = ctx;
  const channel = String(step.channel || "").toLowerCase();
  const body = String(step.body || "").trim();

  if (!body) {
    throw new Error("Message body is empty.");
  }

  if (channel === "email") {
    const to = prospectEmail(prospect);
    if (!to) throw new Error("No email on file for this prospect.");
    if (!user.senderDomain) {
      throw new Error("Connect a sender domain in Settings before sending email.");
    }
    const fromEmail = outreachFromAddress(user.senderDomain);
    if (!fromEmail) throw new Error("Invalid sender domain.");

    const subject = String(step.subject || "").trim() || `Re: ${campaign.name || "Outreach"}`;
    const result = await sendBrevoTransactionalEmail({
      fromEmail,
      fromName: user.name || user.company || "Outreach",
      toEmail: to,
      toName: prospect.displayName || undefined,
      subject,
      textBody: body,
    });
    return { externalMessageId: result.messageId ? String(result.messageId) : "" };
  }

  if (channel === "linkedin") {
    const url = prospectLinkedInUrl(prospect);
    if (!url) throw new Error("No LinkedIn profile URL on file.");
    if (!user.linkupAccountId) {
      throw new Error("Connect LinkedIn in Settings before sending.");
    }
    const result = await sendLinkedInMessageViaLinkup({
      accountId: user.linkupAccountId,
      profileUrl: url,
      messageText: body,
    });
    return {
      externalMessageId: result.entityUrn || result.conversationId || "",
    };
  }

  if (channel === "whatsapp") {
    const to = prospectPhone(prospect);
    if (!to) throw new Error("No mobile phone on file for WhatsApp.");
    if (!user.whatsappConnected || !user.whatsappPhoneNumberId) {
      throw new Error("Connect WhatsApp in Settings before sending.");
    }
    const token = getDecryptedWhatsappAccessToken(user);
    if (!token) throw new Error("WhatsApp credentials are missing.");

    const result = await sendWhatsAppTextMessage({
      accessToken: token,
      phoneNumberId: user.whatsappPhoneNumberId,
      toE164: to,
      body,
    });
    const msgId = result?.messages?.[0]?.id || "";
    return { externalMessageId: msgId ? String(msgId) : "" };
  }

  throw new Error(`Unsupported channel: ${channel}`);
}

/**
 * Process due drip steps across all running campaigns.
 */
export async function processDueDripSends() {
  const now = new Date();
  const runningCampaigns = await Campaign.find({ status: "running" })
    .select("_id user launchChannels")
    .lean();

  if (!runningCampaigns.length) {
    return { processed: 0, sent: 0, failed: 0, campaigns: 0 };
  }

  const campaignIds = runningCampaigns.map((c) => c._id);
  const campaignById = new Map(runningCampaigns.map((c) => [String(c._id), c]));

  const dueProspects = await Prospect.find({
    campaign: { $in: campaignIds },
    outreachStatus: "enrolled",
    dripSequence: {
      $elemMatch: {
        deliveryStatus: "scheduled",
        scheduledAt: { $lte: now },
      },
    },
  })
    .limit(80)
    .lean();

  let processed = 0;
  let sent = 0;
  let failed = 0;
  const touchedCampaigns = new Set();

  for (const prospect of dueProspects) {
    if (processed >= MAX_STEPS_PER_CRON_RUN) break;

    const campaign = campaignById.get(String(prospect.campaign));
    if (!campaign) continue;

    const user = await User.findById(campaign.user).lean();
    if (!user) continue;

    const fullCampaign = await Campaign.findById(campaign._id).lean();
    const activeChannels = new Set(
      (fullCampaign?.launchChannels || []).map((c) => String(c).toLowerCase())
    );

    const seq = Array.isArray(prospect.dripSequence) ? [...prospect.dripSequence] : [];
    let changed = false;

    for (let i = 0; i < seq.length; i++) {
      if (processed >= MAX_STEPS_PER_CRON_RUN) break;

      const step = seq[i];
      if (step.deliveryStatus !== "scheduled") continue;
      if (!step.scheduledAt || new Date(step.scheduledAt) > now) continue;

      const channel = String(step.channel || "").toLowerCase();
      if (!activeChannels.has(channel)) {
        seq[i] = {
          ...step,
          deliveryStatus: "skipped",
          deliveryError: "Channel not active for this campaign",
        };
        changed = true;
        processed += 1;
        continue;
      }

      processed += 1;
      try {
        const { externalMessageId } = await sendDripStep({
          user,
          campaign: fullCampaign,
          prospect,
          step,
          stepIndex: i,
        });
        seq[i] = {
          ...step,
          deliveryStatus: "sent",
          sentAt: new Date(),
          deliveryError: "",
          externalMessageId: externalMessageId || "",
        };
        sent += 1;
        changed = true;
      } catch (err) {
        const msg =
          err && typeof err.message === "string"
            ? err.message.slice(0, 400)
            : "Send failed";
        seq[i] = {
          ...step,
          deliveryStatus: "failed",
          deliveryError: msg,
        };
        failed += 1;
        changed = true;
      }
    }

    if (changed) {
      await Prospect.updateOne(
        { _id: prospect._id },
        { $set: { dripSequence: seq } }
      );
      await maybeCompleteProspectOutreach(prospect._id);
      touchedCampaigns.add(String(prospect.campaign));
    }
  }

  for (const cid of touchedCampaigns) {
    const c = campaignById.get(cid);
    if (c?.user) {
      await refreshCampaignOutreachStats(cid, c.user);
    }
  }

  return {
    processed,
    sent,
    failed,
    campaigns: runningCampaigns.length,
    touchedCampaigns: touchedCampaigns.size,
  };
}
