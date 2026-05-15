import mongoose from 'mongoose'
import { getServerSession } from 'next-auth'
import authOptions from '@/app/auth/options'
import { User } from '@/models/User'
import {
  authenticateSenderDomain,
  getSenderDomainConfiguration,
  isDkimFullyVerified,
  normalizeBrevoDnsRecords,
} from '@/libs/brevoDomains'

export const dynamic = 'force-dynamic'

/** Labels for records still missing or not verified (`status` not true). */
function pendingRecordLabels(dr) {
  if (!dr || typeof dr !== 'object') return ['Domain verification', 'DKIM', 'DMARC']
  const out = []
  if (!dr.brevo_code || dr.brevo_code.status !== true) {
    out.push('Domain verification')
  }
  if (!isDkimFullyVerified(dr)) {
    out.push('DKIM')
  }
  if (!dr.dmarc_record || dr.dmarc_record.status !== true) {
    out.push('DMARC')
  }
  return out
}

/**
 * POST — ask Brevo to verify DNS; returns updated configuration.
 * On authenticate failure we still return fresh `dns_records` from Brevo so the UI
 * matches what their API sees (often DKIM host/value mismatch while other TXTs look OK).
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 })
    }
    await mongoose.connect(process.env.MONGO_URL)
    const user = await User.findOne({ email: session.user.email })
    if (!user) {
      return new Response('User not found', { status: 404 })
    }
    if (!user.senderDomain) {
      return Response.json({ error: 'No sender domain configured.' }, { status: 400 })
    }

    const domain = user.senderDomain

    let authenticateError = null
    let authenticateErrorCode = null
    try {
      await authenticateSenderDomain(domain)
    } catch (e) {
      authenticateError = e.body?.message || e.message || 'Verification failed.'
      authenticateErrorCode = e.code || e.body?.code || null
    }

    let cfg
    try {
      cfg = await getSenderDomainConfiguration(domain)
    } catch (e) {
      if (authenticateError) {
        return Response.json(
          {
            error: authenticateError,
            code: authenticateErrorCode,
          },
          { status: 502 }
        )
      }
      throw e
    }

    const dr = normalizeBrevoDnsRecords(cfg?.dns_records) || {}
    const pendingRecordHints = pendingRecordLabels(dr)

    return Response.json({
      ok: true,
      domain: cfg.domain,
      verified: Boolean(cfg.verified),
      authenticated: Boolean(cfg.authenticated),
      dns_records: normalizeBrevoDnsRecords(cfg?.dns_records),
      domain_provider: cfg.domain_provider ?? null,
      message: cfg.message ?? null,
      authenticateFailed: Boolean(authenticateError),
      authenticateError: authenticateError || null,
      authenticateErrorCode: authenticateErrorCode || null,
      pendingRecordHints,
      /** When Brevo says authenticate failed but all three TXT statuses are true — worth re-trying or checking value formatting. */
      allRecordsReportedOk:
        Boolean(dr?.brevo_code?.status === true) &&
        isDkimFullyVerified(dr) &&
        Boolean(dr?.dmarc_record?.status === true),
    })
  } catch (error) {
    console.error(error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
