/**
 * WhatsApp Cloud API (Graph) — see Meta docs:
 * https://developers.facebook.com/docs/whatsapp/cloud-api/overview
 * https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
 *
 * IDs (do not mix them up):
 * - **Phone number ID** — used in `POST /{phone-number-id}/messages` (sending). From WhatsApp → API
 *   Setup in the app dashboard.
 * - **WhatsApp Business Account ID (WABA)** — used in `GET|POST /{whatsapp-business-account-id}/message_templates`.
 *   From Business settings → WhatsApp accounts. Some Graph setups do **not** expose `whatsapp_business_account`
 *   on `GET /{phone-number-id}` (see Cloud API phone numbers doc); we try it best-effort, then fall back to the
 *   WABA you paste in Settings.
 * - **Facebook App ID** — identifies your Meta app; not used as a path parameter for these Cloud API calls.
 *
 * Templates reference: https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/
 */

import { analyzeWhatsAppBodyVariables, metaBodyExamplePayload } from '@/libs/whatsappTemplateBodyVariables'

const DEFAULT_GRAPH_VERSION = 'v21.0'

export function getWhatsAppGraphVersion() {
  const v = process.env.WHATSAPP_GRAPH_API_VERSION
  if (v && String(v).trim()) {
    const s = String(v).trim()
    return s.startsWith('v') ? s : `v${s}`
  }
  return DEFAULT_GRAPH_VERSION
}

function graphBase() {
  return `https://graph.facebook.com/${getWhatsAppGraphVersion()}`
}

/**
 * Fetch phone-number metadata to validate token + phone number ID (Cloud API / Graph).
 * Does not request `whatsapp_business_account` on this call — that field is not on the phone node for
 * many setups and causes (#100) nonexisting field. Use {@link tryFetchWhatsappBusinessAccountLinkedToPhone}
 * for a separate best-effort WABA lookup.
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/phone-numbers#get-a-single-phone-number
 * @param {{ accessToken: string, phoneNumberId: string }} opts
 */
export async function fetchWhatsAppPhoneNumber(opts) {
  const { accessToken, phoneNumberId } = opts
  const id = String(phoneNumberId || '').trim()
  if (!id) throw new Error('Phone number ID is required.')
  const token = String(accessToken || '').trim()
  if (!token) throw new Error('Access token is required.')

  const url = `${graphBase()}/${encodeURIComponent(
    id
  )}?fields=id,display_phone_number,verified_name,quality_rating`
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      `Graph API error (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.graph = data?.error
    throw err
  }
  return data
}

/**
 * WABA id nested on the WhatsApp Business Phone Number node (Graph).
 * @param {Record<string, unknown>} meta Graph JSON that may include `whatsapp_business_account` (e.g. from {@link tryFetchWhatsappBusinessAccountLinkedToPhone})
 * @returns {string|null}
 */
export function extractWhatsappBusinessAccountIdFromPhoneNode(meta) {
  const w = meta?.whatsapp_business_account
  if (w == null) return null
  if (typeof w === 'string' && /^\d+$/.test(w.trim())) return w.trim()
  if (typeof w === 'object' && w.id != null && /^\d+$/.test(String(w.id).trim())) {
    return String(w.id).trim()
  }
  return null
}

/**
 * Best-effort: some Graph tokens return `whatsapp_business_account` on the phone node; many do not (#100).
 * Never throws — returns null if the field is missing or the request fails.
 * @param {{ accessToken: string, phoneNumberId: string }} opts
 * @returns {Promise<string|null>}
 */
export async function tryFetchWhatsappBusinessAccountLinkedToPhone(opts) {
  const { accessToken, phoneNumberId } = opts
  const id = String(phoneNumberId || '').trim()
  const token = String(accessToken || '').trim()
  if (!id || !token) return null

  const url = `${graphBase()}/${encodeURIComponent(id)}?fields=whatsapp_business_account{id}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return null
  }
  return extractWhatsappBusinessAccountIdFromPhoneNode(data)
}

/**
 * Verify an id is a WhatsApp Business Account (WABA), not a phone number or app node.
 * GET /{whatsapp-business-account-id}?fields=...
 * @param {{ accessToken: string, wabaId: string }} opts
 */
export async function fetchWhatsAppBusinessAccountById(opts) {
  const { accessToken, wabaId } = opts
  const id = String(wabaId || '').trim()
  const token = String(accessToken || '').trim()
  if (!id) throw new Error('WhatsApp Business Account ID is required.')
  if (!token) throw new Error('Access token is required.')

  const url = `${graphBase()}/${encodeURIComponent(
    id
  )}?fields=id,name,currency,message_template_namespace`
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      `This ID is not a valid WhatsApp Business Account for this token (${res.status}).`
    const err = new Error(msg)
    err.status = res.status
    err.graph = data?.error
    throw err
  }
  return data
}

/**
 * Send a plain text message (session message — requires an open customer care window
 * or prior user opt-in; cold outreach typically uses approved templates instead).
 * https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
 *
 * @param {{ accessToken: string, phoneNumberId: string, toE164: string, body: string }} opts
 */
export async function sendWhatsAppTextMessage(opts) {
  const { accessToken, phoneNumberId, toE164, body } = opts
  const id = String(phoneNumberId || '').trim()
  const token = String(accessToken || '').trim()
  const to = String(toE164 || '').replace(/\D/g, '')
  const text = String(body || '').trim()
  if (!id || !token || !to || !text) {
    throw new Error('phoneNumberId, accessToken, toE164, and body are required.')
  }

  const url = `${graphBase()}/${encodeURIComponent(id)}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      `Could not send message (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.graph = data?.error
    throw err
  }
  return data
}

export function normalizeE164Digits(value) {
  return String(value || '').replace(/\D/g, '')
}

/**
 * List message templates for a WABA (Meta Graph API).
 * https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/
 *
 * @param {{ accessToken: string, wabaId: string, after?: string, limit?: number }} opts
 */
export async function listWhatsAppMessageTemplates(opts) {
  const { accessToken, wabaId, after, limit = 25 } = opts
  const waba = String(wabaId || '').trim()
  const token = String(accessToken || '').trim()
  if (!waba || !token) throw new Error('wabaId and accessToken are required.')

  const lim = Math.min(100, Math.max(1, Number(limit) || 25))
  const params = new URLSearchParams({
    fields:
      'name,status,language,category,components,quality_score,rejected_reason,last_updated_time,id',
    limit: String(lim),
  })
  if (after && String(after).trim()) params.set('after', String(after).trim())

  const url = `${graphBase()}/${encodeURIComponent(waba)}/message_templates?${params.toString()}`
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      `Could not list templates (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.graph = data?.error
    throw err
  }
  return data
}

/**
 * Create a text-only template (BODY component only). Submitted to Meta for review.
 * https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/
 *
 * @param {{
 *   accessToken: string
 *   wabaId: string
 *   name: string
 *   language: string
 *   category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
 *   bodyText: string
 *   bodyExamples?: string[] | null — sample values for {{1}}..{{N}} when the body uses numbered variables (Meta `example.body_text`).
 * }} opts
 */
export async function createWhatsAppTextOnlyTemplate(opts) {
  const { accessToken, wabaId, name, language, category, bodyText, bodyExamples } = opts
  const waba = String(wabaId || '').trim()
  const token = String(accessToken || '').trim()
  const tmplName = String(name || '').trim()
  const lang = String(language || '').trim()
  const cat = String(category || '').trim().toUpperCase()
  const text = String(bodyText || '').trim()

  if (!waba || !token) throw new Error('wabaId and accessToken are required.')
  if (!tmplName) throw new Error('Template name is required.')
  if (!lang) throw new Error('Language is required.')
  if (!['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(cat)) {
    throw new Error('category must be MARKETING, UTILITY, or AUTHENTICATION.')
  }
  if (!text) throw new Error('Message body is required.')

  const analysis = analyzeWhatsAppBodyVariables(text)
  if ('error' in analysis) {
    const err = new Error(analysis.error)
    err.status = 400
    throw err
  }

  const bodyComponent = { type: 'BODY', text }

  if (analysis.count > 0) {
    const examples = Array.isArray(bodyExamples)
      ? bodyExamples.map((x) => String(x ?? '').trim())
      : []
    if (examples.length !== analysis.count) {
      const err = new Error(
        `Body uses {{1}} through {{${analysis.count}}}. Provide exactly ${analysis.count} sample string(s) in bodyExamples for Meta review.`
      )
      err.status = 400
      throw err
    }
    for (let i = 0; i < examples.length; i++) {
      if (!examples[i]) {
        const err = new Error(`Sample value for {{${i + 1}}} cannot be empty.`)
        err.status = 400
        throw err
      }
    }
    bodyComponent.example = metaBodyExamplePayload(examples)
  }

  const url = `${graphBase()}/${encodeURIComponent(waba)}/message_templates`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: tmplName,
      language: lang,
      category: cat,
      components: [bodyComponent],
    }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error?.error_user_msg ||
      `Could not create template (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.graph = data?.error
    throw err
  }
  return data
}
