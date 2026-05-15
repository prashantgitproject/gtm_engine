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

function joinSignalsForPlaybook(signals) {
  if (!Array.isArray(signals) || signals.length === 0) return "";
  return signals
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

/** Human-readable block the model must align to (mirrors DB campaign fields). */
export function buildCampaignPlaybookText(brief) {
  const name = String(brief?.name ?? "").trim();
  const goal = String(brief?.goal ?? "").trim();
  const description = String(brief?.description ?? "").trim();
  const signals = Array.isArray(brief?.signals) ? brief.signals : [];
  const sigLine = joinSignalsForPlaybook(signals);

  const lines = [
    "=== CAMPAIGN PLAYBOOK (every touch should advance this; do not ignore non-empty fields) ===",
  ];
  lines.push(name ? `Campaign name: ${name}` : "Campaign name: (not set)");
  lines.push(
    goal
      ? `Primary goal / outcome to optimize for: ${goal}`
      : "Primary goal / outcome: (not set in DB — infer one specific outcome, e.g. book a short call or earn a reply, and reflect it clearly in each CTA.)"
  );
  lines.push(
    description
      ? `Narrative / value prop / \"about\" (from campaign description): ${description}`
      : "Narrative / value prop: (not set — stay concrete using prospect + company context; avoid invented product claims.)"
  );
  lines.push(
    sigLine
      ? `Signals / proof points to weave in when credible: ${sigLine}`
      : "Signals / proof points: (none in DB — rely on prospect whyFit, role, and company context.)"
  );
  lines.push("=== END PLAYBOOK ===");
  return lines.join("\n");
}

export function campaignBriefForDripPrompt(campaign) {
  const signals = Array.isArray(campaign.signals) ? campaign.signals : [];
  const core = {
    name: campaign.name || "",
    goal: campaign.goal || "",
    description: campaign.description || "",
    signals,
  };
  return {
    ...core,
    playbook: buildCampaignPlaybookText(core),
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
  const brief =
    campaignBrief?.playbook != null
      ? campaignBrief
      : {
          ...campaignBrief,
          playbook: buildCampaignPlaybookText(campaignBrief),
        };

  const userPayload = JSON.stringify(
    {
      campaign: brief,
      prospects: prospectChunk,
    },
    null,
    0
  );

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.55,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You design multi-touch outbound drip sequences for B2B GTM teams.

The JSON "campaign" object is loaded from the database (name, goal, description, signals) and includes "playbook", a plain-text digest of those fields. Treat non-empty goal, description, and signals as mandatory subtext for positioning and CTAs; read playbook first if you need a single block.

Return one JSON object with a single key "items" whose value is an array.
Each item: {"prospectId":"<string>","sequence":[...]}.

Rules for every prospect in the input:
- sequence has 5 to 7 steps, days between 1 and 14 (integers), strictly non-decreasing days.
- channel must be exactly one of: "email", "linkedin", "whatsapp" (lowercase).
- Include at least one step for each of the three channels.
- Step shape: {"day":number,"channel":"email"|"linkedin"|"whatsapp","subject":"string","body":"string"}
- For email: subject is a compelling subject line; body is the email (plain text, concise).
- For linkedin and whatsapp: subject must be "" (empty string). body is the full message (LinkedIn connection note or DM-style text; WhatsApp message — keep under ~400 chars when possible).
- Goal-oriented copy: each step should visibly advance the campaign's stated goal (e.g. meeting, pilot, reply). When campaign.goal or playbook mentions an outcome, echo that intent with channel-appropriate CTAs (softer on LinkedIn/WhatsApp, clearer on email). When description/narrative is non-empty, tie value prop and language to it; do not write copy that could apply unchanged to a different campaign.
- Use campaign.signals as concrete hooks (metrics, events, tech, industry angles) when they fit the prospect; skip any signal that would sound forced.
- Personalize using company name, person name, role, and whyFit. When present, lean on linkedinHeadline, about, education, experience, skills, and companyContext for credible specifics. Do not use bracket placeholders like {{first_name}}.
- Avoid generic filler ("Hope you're well", "Just circling back", "touching base") unless the channel tone requires a single short courtesy clause; prefer a specific opener tied to the campaign thesis or the prospect/company.
- Vary angle across days (e.g. problem → insight → proof → direct ask) while staying one coherent motion toward the same goal.

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
