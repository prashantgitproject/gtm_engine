const BREVO_BASE = 'https://api.brevo.com/v3'

/**
 * Normalize user input to a bare hostname (lowercase, no protocol/path).
 * @param {string} input
 * @returns {string|null}
 */
export function normalizeDomain(input) {
  if (!input || typeof input !== 'string') return null
  let s = input.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '')
  s = s.split('/')[0].split(':')[0]
  if (!s) return null
  if (s.endsWith('.')) s = s.slice(0, -1)
  return s
}

/**
 * Basic hostname validation (apex or subdomain).
 * @param {string} d
 * @returns {boolean}
 */
export function isValidDomain(d) {
  if (!d || d.length > 253) return false
  const labels = d.split('.')
  if (labels.length < 2) return false
  const labelRe = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
  return labels.every((l) => labelRe.test(l) && l.length <= 63)
}

function domainPathSegment(domain) {
  return encodeURIComponent(domain)
}

/**
 * Coerce one Brevo DNS row to { type, host_name, value, status }.
 * @param {object|null|undefined} item
 * @returns {object|null}
 */
function flatDnsRecord(item) {
  if (!item || typeof item !== 'object') return null
  const type = String(item.type || item.recordType || item.record_type || 'TXT').trim() || 'TXT'
  const host_name = String(
    item.host_name ?? item.hostname ?? item.name ?? item.host ?? item.record_name ?? ''
  )
  const value = String(item.value ?? item.content ?? item.text ?? item.data ?? '').trim()
  const status =
    item.status === true ||
    item.status === 'true' ||
    item.validated === true ||
    item.is_verified === true
  if (!host_name && !value) return null
  return { type, host_name, value, status }
}

function splitDnsRecordArray(list) {
  const dkimList = []
  const brevoCandidates = []
  let dmarc_record = null

  for (const item of list) {
    const r = flatDnsRecord(item)
    if (!r) continue

    const vLower = r.value.toLowerCase()
    const hLower = r.host_name.toLowerCase()
    const rt = String(item.record_type || item.recordType || item.category || item.kind || '')
      .toLowerCase()

    const isDmarc =
      rt === 'dmarc' ||
      vLower.startsWith('v=dmarc1') ||
      hLower.includes('_dmarc')
    const isDkim =
      rt === 'dkim' ||
      rt === 'dkim1' ||
      rt === 'dkim2' ||
      vLower.startsWith('v=dkim1') ||
      vLower.startsWith('v=dkim2') ||
      hLower.includes('_domainkey')

    if (isDmarc) {
      dmarc_record = r
      continue
    }
    if (isDkim) {
      dkimList.push(r)
      continue
    }
    if (vLower.startsWith('v=spf1')) {
      continue
    }
    brevoCandidates.push(r)
  }

  const brevo_code = brevoCandidates.length ? brevoCandidates[0] : null
  return { brevo_code, dmarc_record, dkimList }
}

/**
 * True when every DKIM row Brevo returned is verified (`status === true`).
 * @param {{ dkim_record?: object|null, dkim_records?: object[]|null }|null|undefined} dr
 */
export function isDkimFullyVerified(dr) {
  if (!dr) return false
  const list =
    Array.isArray(dr.dkim_records) && dr.dkim_records.length > 0
      ? dr.dkim_records
      : dr.dkim_record
        ? [dr.dkim_record]
        : []
  if (!list.length) return false
  return list.every((r) => r && r.status === true)
}

/**
 * Brevo slot keys like `dkim1Record`, `dkim2Record`, `dkim_record` (not `dkim_records` array).
 * @param {string} k
 */
function isDkimSlotKey(k) {
  const kl = String(k).toLowerCase()
  if (kl === 'dkim_records') return false
  return kl.startsWith('dkim') && kl.endsWith('record') && !kl.endsWith('records')
}

/**
 * Collect all DKIM rows from a legacy Brevo object (`dkim_record`, `dkim1Record`, `dkim2Record`, …).
 * @param {object} raw
 * @returns {object[]}
 */
function collectAllDkimFromLegacyObject(raw) {
  if (!raw || typeof raw !== 'object') return []
  if (Array.isArray(raw.dkim_records) && raw.dkim_records.length > 0) {
    return raw.dkim_records.map((x) => flatDnsRecord(x)).filter(Boolean)
  }
  const keys = Object.keys(raw).filter((k) => isDkimSlotKey(k) && raw[k] != null && typeof raw[k] === 'object')
  keys.sort((a, b) => {
    const na = String(a).match(/(\d+)/)?.[1]
    const nb = String(b).match(/(\d+)/)?.[1]
    return (na ? parseInt(na, 10) : 0) - (nb ? parseInt(nb, 10) : 0)
  })
  const fromKeys = keys.map((k) => flatDnsRecord(raw[k])).filter(Boolean)
  if (fromKeys.length) return fromKeys
  if (raw.dkim_record) {
    const one = flatDnsRecord(raw.dkim_record) || raw.dkim_record
    return one ? [one] : []
  }
  return []
}

function looksLikeBrevoDnsObject(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  return (
    Object.prototype.hasOwnProperty.call(raw, 'brevo_code') ||
    Object.prototype.hasOwnProperty.call(raw, 'dmarc_record') ||
    Object.prototype.hasOwnProperty.call(raw, 'dkim_record') ||
    (Array.isArray(raw.dkim_records) && raw.dkim_records.length > 0) ||
    Object.keys(raw).some((k) => isDkimSlotKey(k) && raw[k] != null)
  )
}

/**
 * Normalize Brevo `dns_records` from GET/POST: object shape (OpenAPI) or **array** of rows (live API).
 * Output always includes optional `dkim_records` (1–N) plus `dkim_record` (first) for backward compatibility.
 * @param {object|array|null|undefined} raw
 * @returns {{ brevo_code: object|null, dkim_record: object|null, dkim_records: object[]|null, dmarc_record: object|null }|null}
 */
export function normalizeBrevoDnsRecords(raw) {
  if (raw == null) return null

  if (Array.isArray(raw)) {
    const { brevo_code, dmarc_record, dkimList } = splitDnsRecordArray(raw)
    return {
      brevo_code: brevo_code || null,
      dmarc_record: dmarc_record || null,
      dkim_record: dkimList[0] || null,
      dkim_records: dkimList.length ? dkimList : null,
    }
  }

  if (typeof raw === 'object') {
    const nestedList =
      Array.isArray(raw.records) && raw.records.length > 0
        ? raw.records
        : Array.isArray(raw.dns_records) && raw.dns_records.length > 0
          ? raw.dns_records
          : null
    if (nestedList) {
      return normalizeBrevoDnsRecords(nestedList)
    }

    if (looksLikeBrevoDnsObject(raw)) {
      const dkimList = collectAllDkimFromLegacyObject(raw)
      return {
        brevo_code: raw.brevo_code ? flatDnsRecord(raw.brevo_code) || raw.brevo_code : null,
        dmarc_record: raw.dmarc_record ? flatDnsRecord(raw.dmarc_record) || raw.dmarc_record : null,
        dkim_record: dkimList[0] || null,
        dkim_records: dkimList.length ? dkimList : null,
      }
    }
  }

  return null
}

async function brevoJson(path, options = {}) {
  const key = process.env.BREVO_API_KEY
  if (!key) {
    const err = new Error('Email sending is not configured (missing BREVO_API_KEY).')
    err.code = 'missing_brevo_key'
    throw err
  }
  const res = await fetch(`${BREVO_BASE}${path}`, {
    ...options,
    headers: {
      accept: 'application/json',
      'api-key': key,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }
  if (!res.ok) {
    const err = new Error(data?.message || `Brevo request failed (${res.status})`)
    err.status = res.status
    err.code = data?.code
    err.body = data
    throw err
  }
  return data
}

/**
 * Create sender domain in Brevo; returns API payload including dns_records.
 * @param {string} domain
 */
export async function createSenderDomain(domain) {
  return brevoJson('/senders/domains', {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  })
}

/**
 * @param {string} domain
 */
export async function getSenderDomainConfiguration(domain) {
  const seg = domainPathSegment(domain)
  return brevoJson(`/senders/domains/${seg}`, { method: 'GET' })
}

/**
 * Trigger DNS verification / authentication check at Brevo.
 * @param {string} domain
 */
export async function authenticateSenderDomain(domain) {
  const seg = domainPathSegment(domain)
  return brevoJson(`/senders/domains/${seg}/authenticate`, {
    method: 'PUT',
  })
}

/**
 * @param {string} domain
 */
export async function deleteSenderDomain(domain) {
  const seg = domainPathSegment(domain)
  return brevoJson(`/senders/domains/${seg}`, { method: 'DELETE' })
}
