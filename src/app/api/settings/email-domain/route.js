import mongoose from 'mongoose'
import { getServerSession } from 'next-auth'
import authOptions from '@/app/auth/options'
import { User } from '@/models/User'
import {
  authenticateSenderDomain,
  createSenderDomain,
  deleteSenderDomain,
  getSenderDomainConfiguration,
  isValidDomain,
  normalizeBrevoDnsRecords,
  normalizeDomain,
} from '@/libs/brevoDomains'

async function requireUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { error: new Response('Unauthorized', { status: 401 }) }
  }
  await mongoose.connect(process.env.MONGO_URL)
  const user = await User.findOne({ email: session.user.email })
  if (!user) {
    return { error: new Response('User not found', { status: 404 }) }
  }
  return { user }
}

function mapDnsPayload(cfg) {
  return normalizeBrevoDnsRecords(cfg?.dns_records)
}

/**
 * GET — current domain + live DNS / verification state from Brevo.
 */
export async function GET() {
  try {
    const r = await requireUser()
    if (r.error) return r.error
    const { user } = r

    if (!user.senderDomain) {
      return Response.json({
        configured: false,
        domain: null,
        verified: false,
        authenticated: false,
        dns_records: null,
        domain_provider: null,
      })
    }

    try {
      const cfg = await getSenderDomainConfiguration(user.senderDomain)
      return Response.json({
        configured: true,
        domain: cfg.domain,
        verified: Boolean(cfg.verified),
        authenticated: Boolean(cfg.authenticated),
        dns_records: mapDnsPayload(cfg),
        domain_provider: cfg.domain_provider ?? null,
      })
    } catch (e) {
      console.error('Brevo get domain:', e)
      return Response.json({
        configured: true,
        domain: user.senderDomain,
        verified: false,
        authenticated: false,
        dns_records: null,
        domain_provider: null,
        dnsStatusError: e.message || 'Could not load domain DNS status.',
      })
    }
  } catch (error) {
    console.error(error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

/**
 * POST — register domain in Brevo and save on user (replaces previous domain).
 * Body: { domain: string }
 */
export async function POST(request) {
  try {
    const r = await requireUser()
    if (r.error) return r.error
    const { user } = r

    let body = {}
    try {
      body = await request.json()
    } catch {
      /* ignore */
    }
    const raw = body?.domain
    const domain = normalizeDomain(typeof raw === 'string' ? raw : '')
    if (!domain || !isValidDomain(domain)) {
      return Response.json(
        { error: 'Enter a valid domain (e.g. yourcompany.com).' },
        { status: 400 }
      )
    }

    const previous = user.senderDomain
    if (previous && previous !== domain) {
      try {
        await deleteSenderDomain(previous)
      } catch (delErr) {
        console.warn('Could not remove previous Brevo domain:', previous, delErr)
      }
    }

    let created = null
    try {
      created = await createSenderDomain(domain)
    } catch (e) {
      const dup =
        e.code === 'duplicate_parameter' ||
        e.code === 'duplicate_request' ||
        /already exists/i.test(String(e.message || ''))
      if (dup) {
        try {
          await getSenderDomainConfiguration(domain)
        } catch {
          return Response.json(
            { error: e.body?.message || e.message || 'Could not add domain.' },
            { status: 400 }
          )
        }
      } else {
        return Response.json(
          { error: e.body?.message || e.message || 'Could not add domain.' },
          { status: e.status >= 400 && e.status < 600 ? e.status : 400 }
        )
      }
    }

    user.senderDomain = domain
    await user.save()

    let cfg = null
    try {
      cfg = await getSenderDomainConfiguration(domain)
    } catch {
      cfg = null
    }

    const dns =
      cfg?.dns_records ||
      created?.dns_records ||
      created?.DNS_records ||
      null

    return Response.json({
      ok: true,
      domain,
      verified: Boolean(cfg?.verified),
      authenticated: Boolean(cfg?.authenticated),
      dns_records: dns
        ? {
            brevo_code: dns.brevo_code,
            dkim_record: dns.dkim_record,
            dmarc_record: dns.dmarc_record,
          }
        : null,
      domain_provider: cfg?.domain_provider ?? created?.domain_provider ?? null,
      message:
        created?.message ||
        'Domain added. Add the DNS records below at your registrar, then verify.',
    })
  } catch (error) {
    console.error(error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

/**
 * DELETE — remove domain from Brevo and clear user field.
 */
export async function DELETE() {
  try {
    const r = await requireUser()
    if (r.error) return r.error
    const { user } = r

    const domain = user.senderDomain
    if (domain) {
      try {
        await deleteSenderDomain(domain)
      } catch (e) {
        console.warn('Brevo delete domain:', e)
      }
    }
    user.senderDomain = null
    await user.save()

    return Response.json({ ok: true })
  } catch (error) {
    console.error(error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
