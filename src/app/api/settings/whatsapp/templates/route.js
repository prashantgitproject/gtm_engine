import mongoose from 'mongoose'
import { getServerSession } from 'next-auth'
import authOptions from '@/app/auth/options'
import {
  createWhatsAppTextOnlyTemplate,
  fetchWhatsAppBusinessAccountById,
  listWhatsAppMessageTemplates,
  tryFetchWhatsappBusinessAccountLinkedToPhone,
} from '@/libs/whatsappCloudApi'
import { getDecryptedWhatsappAccessToken } from '@/libs/whatsappCredentials'
import { User } from '@/models/User'

export const dynamic = 'force-dynamic'

async function requireWhatsappUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return { error: new Response('Unauthorized', { status: 401 }) }
  }
  await mongoose.connect(process.env.MONGO_URL)
  const user = await User.findOne({ email: session.user.email })
  if (!user) {
    return { error: new Response('User not found', { status: 404 }) }
  }
  if (!user.whatsappConnected) {
    return {
      error: Response.json(
        { error: 'Connect WhatsApp in Settings before managing templates.' },
        { status: 400 }
      ),
    }
  }
  const accessToken = getDecryptedWhatsappAccessToken(user)
  if (!accessToken) {
    return {
      error: Response.json(
        { error: 'WhatsApp token is missing. Disconnect and connect again.' },
        { status: 400 }
      ),
    }
  }
  return { user, accessToken }
}

/**
 * Resolve WABA id for `/{waba-id}/message_templates` — never use Phone number ID here.
 * Clears corrupt DB rows where WABA was mistakenly set equal to Phone number ID.
 */
async function resolveWabaId(user, accessToken) {
  const phoneId = user.whatsappPhoneNumberId ? String(user.whatsappPhoneNumberId).trim() : ''
  let dirty = false

  if (user.whatsappBusinessAccountId && phoneId && String(user.whatsappBusinessAccountId) === phoneId) {
    user.whatsappBusinessAccountId = null
    dirty = true
  }

  const wStored = user.whatsappBusinessAccountId ? String(user.whatsappBusinessAccountId).trim() : ''
  if (wStored && wStored !== phoneId) {
    try {
      await fetchWhatsAppBusinessAccountById({ accessToken, wabaId: wStored })
      if (dirty) await user.save()
      return wStored
    } catch {
      user.whatsappBusinessAccountId = null
      dirty = true
    }
  }

  if (!phoneId) {
    if (dirty) await user.save()
    return null
  }

  try {
    const id = await tryFetchWhatsappBusinessAccountLinkedToPhone({
      accessToken,
      phoneNumberId: phoneId,
    })
    if (!id || id === phoneId) {
      if (dirty) await user.save()
      return null
    }
    await fetchWhatsAppBusinessAccountById({ accessToken, wabaId: id })
    user.whatsappBusinessAccountId = id
    await user.save()
    return id
  } catch (e) {
    console.error('resolveWabaId', e)
    if (dirty) await user.save()
    return null
  }
}

function normalizeMetaTemplateName(input) {
  const s = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return s.slice(0, 512)
}

function graphPermissionHint(err) {
  const code = err?.graph?.code
  if (code === 10 || code === 200 || err?.status === 403) {
    return 'Your access token may need the whatsapp_business_management permission (System User or app role with template access).'
  }
  return null
}

/**
 * GET — Meta Graph: GET /{whatsapp-business-account-id}/message_templates
 * https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/
 */
export async function GET(request) {
  try {
    const r = await requireWhatsappUser()
    if (r.error) return r.error
    const { user, accessToken } = r

    const wabaId = await resolveWabaId(user, accessToken)
    if (!wabaId) {
      return Response.json(
        {
          error:
            'Could not resolve a valid WhatsApp Business Account ID for template APIs. Phone number ID and App ID are not valid here — use the WABA from Business Manager or reconnect with the optional WABA field.',
          hint:
            'Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started — Phone number ID vs WhatsApp Business Account ID.',
        },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const after = searchParams.get('after') || undefined
    const limitRaw = searchParams.get('limit')
    const limit = limitRaw ? Number(limitRaw) : 25

    let data
    try {
      data = await listWhatsAppMessageTemplates({
        accessToken,
        wabaId,
        after,
        limit: Number.isFinite(limit) ? limit : 25,
      })
    } catch (e) {
      const status = e.status >= 400 && e.status < 600 ? e.status : 400
      const hint = graphPermissionHint(e)
      return Response.json(
        {
          error: e.message || 'Could not load templates from Meta.',
          hint: hint || undefined,
        },
        { status }
      )
    }

    return Response.json({
      source: 'meta_graph_api',
      docsUrl:
        'https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/',
      wabaId,
      data: data.data || [],
      paging: data.paging || null,
    })
  } catch (e) {
    console.error('whatsapp templates GET', e)
    return new Response('Internal Server Error', { status: 500 })
  }
}

/**
 * POST — Meta Graph: POST /{whatsapp-business-account-id}/message_templates
 * Text-only BODY component; templates are reviewed by Meta (not instant send).
 */
export async function POST(request) {
  try {
    const r = await requireWhatsappUser()
    if (r.error) return r.error
    const { user, accessToken } = r

    const wabaId = await resolveWabaId(user, accessToken)
    if (!wabaId) {
      return Response.json(
        {
          error:
            'Could not determine your WhatsApp Business Account ID. Reconnect WhatsApp or use a token with whatsapp_business_management.',
        },
        { status: 400 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const rawName = body?.name != null ? String(body.name) : ''
    const name = normalizeMetaTemplateName(rawName)
    if (!name) {
      return Response.json(
        {
          error:
            'Enter a template name using letters, numbers, and underscores (Meta stores names in lowercase).',
        },
        { status: 400 }
      )
    }

    const language = String(body?.language || '').trim()
    if (!language) {
      return Response.json({ error: 'Language is required (e.g. en_US).' }, { status: 400 })
    }

    const category = String(body?.category || 'UTILITY').trim().toUpperCase()
    const bodyText = String(body?.body || body?.bodyText || '').trim()
    if (!bodyText) {
      return Response.json({ error: 'Message body is required.' }, { status: 400 })
    }
    if (bodyText.length > 1024) {
      return Response.json(
        { error: 'Body must be 1024 characters or fewer for this flow.' },
        { status: 400 }
      )
    }

    const bodyExamplesRaw = body?.bodyExamples
    let bodyExamples = null
    if (Array.isArray(bodyExamplesRaw)) {
      bodyExamples = bodyExamplesRaw
    } else if (bodyExamplesRaw != null && bodyExamplesRaw !== '') {
      return Response.json(
        { error: 'bodyExamples must be an array of strings (sample values for {{1}}, {{2}}, …).' },
        { status: 400 }
      )
    }

    let created
    try {
      created = await createWhatsAppTextOnlyTemplate({
        accessToken,
        wabaId,
        name,
        language,
        category,
        bodyText,
        bodyExamples,
      })
    } catch (e) {
      const status =
        e.status >= 400 && e.status < 600 ? e.status : e.message?.includes('variables') ? 400 : 400
      const hint = graphPermissionHint(e)
      return Response.json(
        {
          error: e.message || 'Meta rejected the template request.',
          hint: hint || undefined,
        },
        { status }
      )
    }

    return Response.json({
      ok: true,
      meta: created,
      docsUrl:
        'https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/',
    })
  } catch (e) {
    console.error('whatsapp templates POST', e)
    return new Response('Internal Server Error', { status: 500 })
  }
}
