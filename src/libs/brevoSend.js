const BREVO_BASE = "https://api.brevo.com/v3";

async function brevoJson(path, options = {}) {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    const err = new Error("Email sending is not configured (missing BREVO_API_KEY).");
    err.code = "missing_brevo_key";
    throw err;
  }
  const res = await fetch(`${BREVO_BASE}${path}`, {
    ...options,
    headers: {
      accept: "application/json",
      "api-key": key,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.message || `Brevo request failed (${res.status})`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

/**
 * Send a transactional email via Brevo SMTP API.
 * @param {{ fromEmail: string, fromName?: string, toEmail: string, toName?: string, subject: string, textBody: string, htmlBody?: string }} opts
 */
export async function sendBrevoTransactionalEmail(opts) {
  const fromEmail = String(opts.fromEmail || "").trim();
  const toEmail = String(opts.toEmail || "").trim();
  const subject = String(opts.subject || "").trim();
  const textBody = String(opts.textBody || "").trim();

  if (!fromEmail || !toEmail || !subject || !textBody) {
    throw new Error("fromEmail, toEmail, subject, and textBody are required.");
  }

  const payload = {
    sender: {
      email: fromEmail,
      name: String(opts.fromName || "Outreach").trim() || "Outreach",
    },
    to: [
      {
        email: toEmail,
        name: String(opts.toName || "").trim() || undefined,
      },
    ],
    subject,
    textContent: textBody,
  };

  if (opts.htmlBody && String(opts.htmlBody).trim()) {
    payload.htmlContent = String(opts.htmlBody).trim();
  }

  const data = await brevoJson("/smtp/email", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return {
    messageId: data?.messageId || data?.messageIds?.[0] || null,
    raw: data,
  };
}

/**
 * @param {string} senderDomain
 * @param {string} [localPart]
 */
export function outreachFromAddress(senderDomain, localPart = "outreach") {
  const domain = String(senderDomain || "")
    .trim()
    .toLowerCase();
  if (!domain) return null;
  const local = String(localPart || "outreach")
    .trim()
    .replace(/[^a-z0-9._+-]/gi, "")
    .slice(0, 64);
  return `${local || "outreach"}@${domain}`;
}
