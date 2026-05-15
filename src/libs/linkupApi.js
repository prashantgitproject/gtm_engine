const LINKUP_BASE = 'https://api.linkupapi.com/v2'

function getLinkupApiKey() {
  return process.env.LINKUP_API_KEY || process.env.LINKUP_API_TOKEN || null
}

export async function loginLinkedinToLinkup({ loginToken, country = 'US' }) {
  const apiKey = getLinkupApiKey()
  if (!apiKey) return { skipped: true, reason: 'missing_linkup_api_key' }

  const res = await fetch(`${LINKUP_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      platform: 'linkedin',
      login_token: loginToken,
      country,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.success === false) {
    return {
      skipped: true,
      reason: data?.error?.message || data?.message || 'linkup_login_failed',
    }
  }

  return {
    skipped: false,
    accountId: data?.data?.account_id || data?.account_id || null,
  }
}

/**
 * Send a LinkedIn DM via Linkup API v2.
 * @param {{ accountId: string, profileUrl: string, messageText: string }} opts
 */
export async function sendLinkedInMessageViaLinkup(opts) {
  const apiKey = getLinkupApiKey()
  if (!apiKey) {
    const err = new Error('LinkedIn sending is not configured (missing LINKUP_API_KEY).')
    err.code = 'missing_linkup_key'
    throw err
  }

  const accountId = String(opts.accountId || '').trim()
  const profileUrl = String(opts.profileUrl || '').trim()
  const messageText = String(opts.messageText || '').trim()

  if (!accountId || !profileUrl || !messageText) {
    throw new Error('accountId, profileUrl, and messageText are required.')
  }

  const res = await fetch(`${LINKUP_BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      account_id: accountId,
      action: 'send',
      params: {
        profile_url: profileUrl,
        message_text: messageText,
      },
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.success === false) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `Linkup send failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.body = data
    throw err
  }

  return {
    entityUrn: data?.data?.entityUrn || null,
    conversationId: data?.data?.conversation_id || null,
    deliveredAt: data?.data?.deliveredAt || null,
    raw: data,
  }
}
