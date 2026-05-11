import OpenAI from "openai";

const DRIP_CHANNELS = new Set(["email", "linkedin", "whatsapp"]);

function normalizeStep(raw) {
  if (!raw || typeof raw !== "object") return null;
  const day = Number(raw.day);
  const channel = String(raw.channel || "")
    .toLowerCase()
    .trim();
  if (!Number.isFinite(day) || day < 1 || day > 90) return null;
  if (!DRIP_CHANNELS.has(channel)) return null;
  const subject = channel === "email" ? String(raw.subject ?? "").trim() : "";
  const body = String(raw.body ?? "").trim();
  if (!body) return null;
  return { day, channel, subject, body };
}

export function normalizeDripSequence(seq) {
  if (!Array.isArray(seq)) return [];
  return seq
    .map(normalizeStep)
    .filter(Boolean)
    .sort((a, b) => a.day - b.day || String(a.channel).localeCompare(b.channel));
}

export function campaignBriefForDripPrompt(campaign) {
  return {
    name: campaign.name || "",
    goal: campaign.goal || "",
    description: campaign.description || "",
    signals: Array.isArray(campaign.signals) ? campaign.signals : [],
  };
}

function briefStr(v) {
  const s = String(v ?? "").trim();
  return s === "—" ? "" : s;
}

export function prospectBriefForDripPrompt(row) {
  return {
    prospectId: row._id,
    company: briefStr(row.prospect),
    person: briefStr(row.person),
    role: briefStr(row.role),
    email: briefStr(row.email),
    whyFit: briefStr(row.why),
    signals: Array.isArray(row.signals) ? row.signals : [],
    linkedinHeadline: briefStr(row.linkedinHeadline),
    about: briefStr(row.aboutSummary),
    totalExperienceYears:
      typeof row.totalExperienceYears === "number" &&
      Number.isFinite(row.totalExperienceYears)
        ? row.totalExperienceYears
        : null,
    education: briefStr(row.educationSummary),
    experience: briefStr(row.experienceSummary),
    skills: briefStr(row.skillsSummary),
    companyContext: briefStr(row.companyDossier),
  };
}

export async function generateDripSequencesForChunk(
  openai,
  model,
  campaignBrief,
  prospectChunk
) {
  const userPayload = JSON.stringify(
    {
      campaign: campaignBrief,
      prospects: prospectChunk,
    },
    null,
    0
  );

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.65,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You design multi-touch outbound drip sequences for B2B GTM teams.

Return one JSON object with a single key "items" whose value is an array.
Each item: {"prospectId":"<string>","sequence":[...]}.

Rules for every prospect in the input:
- sequence has 5 to 7 steps, days between 1 and 14 (integers), strictly non-decreasing days.
- channel must be exactly one of: "email", "linkedin", "whatsapp" (lowercase).
- Include at least one step for each of the three channels.
- Step shape: {"day":number,"channel":"email"|"linkedin"|"whatsapp","subject":"string","body":"string"}
- For email: subject is a compelling subject line; body is the email (plain text, concise).
- For linkedin and whatsapp: subject must be "" (empty string). body is the full message (LinkedIn connection note or DM-style text; WhatsApp message — keep under ~400 chars when possible).
- Personalize using company name, person name, role, and whyFit. When present, lean on linkedinHeadline, about, education, experience, skills, and companyContext for credible specifics. Do not use bracket placeholders like {{first_name}}.

If multiple prospects are provided, output one item per prospectId from the input.`,
      },
      { role: "user", content: userPayload },
    ],
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty model response");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Model returned invalid JSON");
  }
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const byId = new Map();
  for (const it of items) {
    const id = it?.prospectId != null ? String(it.prospectId) : "";
    if (!id) continue;
    byId.set(id, normalizeDripSequence(it.sequence));
  }
  return byId;
}

export function createOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || !String(key).trim()) {
    return null;
  }
  return new OpenAI({ apiKey: key });
}

export function dripModelName() {
  return process.env.OPENAI_DRIP_MODEL?.trim() || "gpt-4o-mini";
}
