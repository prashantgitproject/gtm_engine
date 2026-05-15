import { DateTime } from "luxon";

export const DEFAULT_DELIVERY_HOUR = 11;
export const DEFAULT_LAUNCH_TIMEZONE =
  process.env.CAMPAIGN_DELIVERY_TIMEZONE?.trim() || "UTC";

/**
 * Calendar day for drip `day` N: launch date + (N - 1) days at deliveryHour in timezone.
 * @param {{ launchAt: Date, day: number, deliveryHour?: number, timezone?: string }} opts
 * @returns {Date}
 */
export function computeStepScheduledAt(opts) {
  const launchAt = opts.launchAt instanceof Date ? opts.launchAt : new Date();
  const day = Math.max(1, Math.min(90, Number(opts.day) || 1));
  const hour = Math.max(0, Math.min(23, Number(opts.deliveryHour ?? DEFAULT_DELIVERY_HOUR)));
  const zone = opts.timezone?.trim() || DEFAULT_LAUNCH_TIMEZONE;

  const launchLocal = DateTime.fromJSDate(launchAt, { zone });
  const scheduled = launchLocal
    .startOf("day")
    .plus({ days: day - 1 })
    .set({ hour, minute: 0, second: 0, millisecond: 0 });

  return scheduled.toUTC().toJSDate();
}

/**
 * Rebuild scheduledAt for steps that are still pending delivery.
 * @param {object[]} sequence
 * @param {{ launchAt: Date, deliveryHour: number, timezone: string, activeChannels: Set<string> }} ctx
 */
export function applyLaunchScheduleToSequence(sequence, ctx) {
  const { launchAt, deliveryHour, timezone, activeChannels } = ctx;
  return (Array.isArray(sequence) ? sequence : []).map((step) => {
    const channel = String(step.channel || "").toLowerCase();
    const day = Number(step.day) || 1;
    const hour =
      step.deliveryHour != null && Number.isFinite(Number(step.deliveryHour))
        ? Number(step.deliveryHour)
        : deliveryHour;

    if (!activeChannels.has(channel)) {
      return {
        ...step,
        deliveryHour: hour,
        scheduledAt: null,
        deliveryStatus: "skipped",
        deliveryError: "Channel not selected at launch",
        sentAt: step.sentAt || null,
        externalMessageId: step.externalMessageId || "",
      };
    }

    const alreadySent = step.deliveryStatus === "sent";
    if (alreadySent) {
      return { ...step, deliveryHour: hour };
    }

    return {
      ...step,
      deliveryHour: hour,
      scheduledAt: computeStepScheduledAt({
        launchAt,
        day,
        deliveryHour: hour,
        timezone,
      }),
      deliveryStatus: "scheduled",
      deliveryError: "",
      sentAt: null,
      externalMessageId: "",
    };
  });
}

/**
 * After a user edits `day` or `deliveryHour` on a step, reschedule if still queued.
 */
/**
 * Merge UI-edited steps with existing delivery metadata; reschedule queued steps when live.
 * @param {object[]} existingSeq
 * @param {object[]} editedSeq — normalized copy fields only
 * @param {{ launchAt: Date, deliveryHour: number, timezone: string, activeChannels: Set<string>, campaignLive: boolean }|null} scheduleCtx
 */
export function mergeEditedDripSequence(existingSeq, editedSeq, scheduleCtx) {
  const existingByKey = new Map();
  for (const s of Array.isArray(existingSeq) ? existingSeq : []) {
    existingByKey.set(`${Number(s.day)}-${String(s.channel).toLowerCase()}`, s);
  }

  return (Array.isArray(editedSeq) ? editedSeq : []).map((step) => {
    const key = `${Number(step.day)}-${String(step.channel).toLowerCase()}`;
    const prev = existingByKey.get(key);
    const merged = {
      day: step.day,
      channel: step.channel,
      subject: step.subject ?? "",
      body: step.body ?? "",
      deliveryHour:
        prev?.deliveryHour != null ? prev.deliveryHour : scheduleCtx?.deliveryHour,
      scheduledAt: prev?.scheduledAt ?? null,
      deliveryStatus: prev?.deliveryStatus || "pending",
      sentAt: prev?.sentAt ?? null,
      deliveryError: prev?.deliveryError || "",
      externalMessageId: prev?.externalMessageId || "",
    };

    if (scheduleCtx?.campaignLive && merged.deliveryStatus === "scheduled") {
      return rescheduleStepIfQueued(merged, scheduleCtx);
    }
    if (scheduleCtx?.campaignLive && merged.deliveryStatus === "failed") {
      return rescheduleStepIfQueued(
        { ...merged, deliveryStatus: "scheduled", deliveryError: "" },
        scheduleCtx
      );
    }
    return merged;
  });
}

export function rescheduleStepIfQueued(step, ctx) {
  const status = String(step.deliveryStatus || "pending");
  if (status === "sent" || status === "skipped") return step;

  const channel = String(step.channel || "").toLowerCase();
  if (!ctx.activeChannels.has(channel)) return step;

  const day = Number(step.day) || 1;
  const hour =
    step.deliveryHour != null && Number.isFinite(Number(step.deliveryHour))
      ? Number(step.deliveryHour)
      : ctx.deliveryHour;

  return {
    ...step,
    deliveryHour: hour,
    scheduledAt: computeStepScheduledAt({
      launchAt: ctx.launchAt,
      day,
      deliveryHour: hour,
      timezone: ctx.timezone,
    }),
    deliveryStatus: status === "failed" ? "scheduled" : status === "pending" ? "scheduled" : status,
    deliveryError: status === "failed" ? "" : step.deliveryError || "",
  };
}
