import { applyLaunchScheduleToSequence, DEFAULT_DELIVERY_HOUR, DEFAULT_LAUNCH_TIMEZONE } from "@/libs/dripSchedule";
import { refreshCampaignOutreachStats } from "@/libs/campaignOutreachStats";
import { Prospect } from "@/models/Prospect";
import { Campaign } from "@/models/Campaign";
import { getSenderDomainConfiguration } from "@/libs/brevoDomains";

const VALID_CHANNELS = new Set(["email", "linkedin", "whatsapp"]);

/**
 * @param {object} user
 * @param {string[]} channels
 */
export async function validateLaunchChannels(user, channels) {
  const errors = [];

  if (channels.includes("email")) {
    if (!user.senderDomain) {
      errors.push("Connect and verify an email sender domain in Settings.");
    } else {
      try {
        const cfg = await getSenderDomainConfiguration(user.senderDomain);
        if (!cfg?.authenticated) {
          errors.push("Email domain is not authenticated in Brevo yet.");
        }
      } catch {
        errors.push("Could not verify email domain status.");
      }
    }
  }

  if (channels.includes("linkedin")) {
    if (!user.linkedinConnected || !user.linkupAccountId) {
      errors.push("Connect LinkedIn in Settings.");
    }
  }

  if (channels.includes("whatsapp")) {
    if (!user.whatsappConnected || !user.whatsappPhoneNumberId) {
      errors.push("Connect WhatsApp in Settings.");
    }
  }

  return errors;
}

/**
 * @param {{ campaignId: string, userId: object, channels: string[], deliveryHour?: number, timezone?: string }} opts
 */
export async function launchCampaignOutreach(opts) {
  const channels = (opts.channels || [])
    .map((c) => String(c).toLowerCase().trim())
    .filter((c) => VALID_CHANNELS.has(c));

  if (channels.length === 0) {
    throw new Error("Select at least one channel (email, linkedin, or whatsapp).");
  }

  const deliveryHour =
    opts.deliveryHour != null && Number.isFinite(Number(opts.deliveryHour))
      ? Math.max(0, Math.min(23, Number(opts.deliveryHour)))
      : DEFAULT_DELIVERY_HOUR;

  const timezone = opts.timezone?.trim() || DEFAULT_LAUNCH_TIMEZONE;
  const launchAt = new Date();
  const activeChannels = new Set(channels);

  const campaign = await Campaign.findOne({
    _id: opts.campaignId,
    user: opts.userId,
  });

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  if (campaign.dripCampaignStatus !== "complete") {
    throw new Error("Create a drip campaign before launching.");
  }

  if (campaign.status === "running") {
    throw new Error("Campaign is already running.");
  }

  const prospects = await Prospect.find({
    campaign: opts.campaignId,
    user: opts.userId,
  });

  if (!prospects.length) {
    throw new Error("Add prospects to the account book first.");
  }

  let enrolled = 0;

  for (const prospect of prospects) {
    const seq = Array.isArray(prospect.dripSequence) ? prospect.dripSequence : [];
    if (seq.length === 0) continue;

    const scheduled = applyLaunchScheduleToSequence(seq, {
      launchAt,
      deliveryHour,
      timezone,
      activeChannels,
    });

    prospect.dripSequence = scheduled;
    prospect.outreachStatus = "enrolled";
    prospect.outreachEnrolledAt = launchAt;
    await prospect.save();
    enrolled += 1;
  }

  if (enrolled === 0) {
    throw new Error("No prospects have drip sequences to send.");
  }

  campaign.status = "running";
  campaign.launchChannels = channels;
  campaign.launchDeliveryHour = deliveryHour;
  campaign.launchTimezone = timezone;
  campaign.launchedAt = launchAt;
  await campaign.save();

  const stats = await refreshCampaignOutreachStats(opts.campaignId, opts.userId);

  return {
    launchedAt: launchAt.toISOString(),
    channels,
    deliveryHour,
    timezone,
    prospectsEnrolled: enrolled,
    outreachStats: stats,
  };
}
