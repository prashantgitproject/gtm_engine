import mongoose from 'mongoose'
import { getServerSession } from 'next-auth'
import authOptions from '@/app/auth/options'
import { encryptLinkedinToken } from '@/libs/linkedinTokenCrypto'
import {
  fetchWhatsAppBusinessAccountById,
  fetchWhatsAppPhoneNumber,
  normalizeE164Digits,
  tryFetchWhatsappBusinessAccountLinkedToPhone,
} from '@/libs/whatsappCloudApi'
import { getDecryptedWhatsappAccessToken } from '@/libs/whatsappCredentials'
import { User } from '@/models/User'

export const dynamic = 'force-dynamic'

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

export async function GET() {
  try {
    const r = await requireUser()
    if (r.error) return r.error
    const { user } = r
    const pid = user.whatsappPhoneNumberId ? String(user.whatsappPhoneNumberId) : ''
    const wid = user.whatsappBusinessAccountId ? String(user.whatsappBusinessAccountId) : ''
    const wabaLooksWrong = Boolean(pid && wid && pid === wid)

    return Response.json({
      connected: Boolean(user.whatsappConnected),
      phoneNumberId: pid || null,
      whatsappBusinessAccountId: wid || null,
      wabaLooksSameAsPhoneNumberId: wabaLooksWrong,
      idsDocUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started#phone-number-id',
      displayPhone: user.whatsappDisplayPhone || null,
      verifiedName: user.whatsappVerifiedName || null,
      hasEncryptedToken: Boolean(
        user.whatsappTokenCipher && user.whatsappTokenIv && user.whatsappTokenTag
      ),
    })
  } catch (e) {
    console.error('whatsapp settings GET', e)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function POST(request) {
  try {
    const r = await requireUser()
    if (r.error) return r.error
    const { user } = r

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const phoneNumberId = String(body?.phoneNumberId || '').trim()
    const accessToken = String(body?.accessToken || '').trim()
    const displayPhoneInput = body?.displayPhone != null ? String(body.displayPhone).trim() : ''
    const optionalWabaRaw =
      body?.whatsappBusinessAccountId != null ? String(body.whatsappBusinessAccountId).trim() : ''
    const optionalWaba = optionalWabaRaw && /^\d+$/.test(optionalWabaRaw) ? optionalWabaRaw : null

    if (!phoneNumberId || !/^\d+$/.test(phoneNumberId)) {
      return Response.json(
        {
          error:
            'Enter a valid Phone number ID (digits only). Use the value from WhatsApp → API Setup — this is for sending messages. It is not your Facebook App ID and not your WhatsApp Business Account ID.',
        },
        { status: 400 }
      )
    }
    if (!accessToken) {
      return Response.json({ error: 'Enter your WhatsApp access token.' }, { status: 400 })
    }

    let meta
    try {
      meta = await fetchWhatsAppPhoneNumber({ accessToken, phoneNumberId })
    } catch (e) {
      const status = e.status >= 400 && e.status < 600 ? e.status : 400
      return Response.json(
        {
          error: e.message || 'Could not verify credentials with Meta.',
          hint:
            'Confirm the token has whatsapp_business_messaging or whatsapp_business_management, and the Phone number ID matches the same WhatsApp Business app.',
        },
        { status }
      )
    }

    const displayFromMeta = meta.display_phone_number
      ? String(meta.display_phone_number).trim()
      : ''
    if (displayPhoneInput) {
      const want = normalizeE164Digits(displayPhoneInput)
      const got = normalizeE164Digits(displayFromMeta)
      if (want && got && want !== got) {
        return Response.json(
          {
            error:
              'The phone number you entered does not match this Phone number ID according to Meta. Double-check both values in WhatsApp → API Setup.',
            metaDisplayPhone: displayFromMeta || null,
          },
          { status: 400 }
        )
      }
    }

    if (optionalWaba && optionalWaba === phoneNumberId) {
      return Response.json(
        {
          error:
            'WhatsApp Business Account ID cannot be the same string as Phone number ID. You may have pasted the Phone number ID twice, or confused it with your Facebook App ID. WABA is under Business settings → WhatsApp accounts (see get-started docs).',
          hint:
            'Phone number ID → `POST /{phone-number-id}/messages`. WABA → `.../{whatsapp-business-account-id}/message_templates`. App ID is not used in these paths.',
        },
        { status: 400 }
      )
    }

    const wabaFromPhone = await tryFetchWhatsappBusinessAccountLinkedToPhone({
      accessToken,
      phoneNumberId,
    })

    let finalWaba = null
    if (optionalWaba) {
      try {
        await fetchWhatsAppBusinessAccountById({ accessToken, wabaId: optionalWaba })
      } catch (e) {
        const status = e.status >= 400 && e.status < 600 ? e.status : 400
        return Response.json(
          {
            error:
              e.message ||
              'Could not verify this WhatsApp Business Account ID with Meta. Check the ID and token permissions (whatsapp_business_management).',
            hint:
              'Use the WhatsApp Business Account ID from Business Manager, not the Phone number ID and not the Facebook App ID.',
          },
          { status }
        )
      }
      if (wabaFromPhone && optionalWaba !== wabaFromPhone) {
        return Response.json(
          {
            error:
              'The WhatsApp Business Account ID you entered does not match the account Meta links to this Phone number ID. Remove the override or use the WABA shown for this number in Business Manager.',
          },
          { status: 400 }
        )
      }
      finalWaba = optionalWaba
    } else if (wabaFromPhone) {
      if (wabaFromPhone === phoneNumberId) {
        return Response.json(
          {
            error:
              'Meta returned an invalid configuration: WhatsApp Business Account ID matched Phone number ID. Disconnect and re-enter credentials; if it persists, paste the WABA manually from Business Manager.',
          },
          { status: 400 }
        )
      }
      try {
        await fetchWhatsAppBusinessAccountById({ accessToken, wabaId: wabaFromPhone })
      } catch (e) {
        const status = e.status >= 400 && e.status < 600 ? e.status : 400
        return Response.json(
          {
            error:
              e.message ||
              'Could not verify the WhatsApp Business Account from Meta for this phone number. Try pasting your WABA ID explicitly (optional field).',
            hint:
              'Your token needs whatsapp_business_management to read the WABA used for message_templates.',
          },
          { status }
        )
      }
      finalWaba = wabaFromPhone
    } else {
      return Response.json(
        {
          error:
            'Meta did not return a WhatsApp Business Account for this phone number, and auto-discovery is not available for your Graph object (this is normal for Cloud API). Paste your WhatsApp Business Account ID in the optional field — Business settings → WhatsApp accounts. Do not use Phone number ID or Facebook App ID.',
          hint:
            'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started#whatsapp-business-account-id',
        },
        { status: 400 }
      )
    }

    const enc = encryptLinkedinToken(accessToken)
    user.whatsappConnected = true
    user.whatsappPhoneNumberId = phoneNumberId
    user.whatsappBusinessAccountId = finalWaba
    user.whatsappDisplayPhone = displayFromMeta || displayPhoneInput || null
    user.whatsappVerifiedName = meta.verified_name ? String(meta.verified_name) : null
    user.whatsappTokenCipher = enc.cipherText
    user.whatsappTokenIv = enc.iv
    user.whatsappTokenTag = enc.tag
    await user.save()

    return Response.json({
      ok: true,
      connected: true,
      phoneNumberId: user.whatsappPhoneNumberId,
      whatsappBusinessAccountId: user.whatsappBusinessAccountId,
      displayPhone: user.whatsappDisplayPhone,
      verifiedName: user.whatsappVerifiedName,
    })
  } catch (e) {
    console.error('whatsapp settings POST', e)
    return new Response('Internal Server Error', { status: 500 })
  }
}

/**
 * Update stored WhatsApp Business Account ID only (same token). Validates against Meta so we never
 * persist Phone number ID or App ID in the WABA field by mistake.
 */
export async function PATCH(request) {
  try {
    const r = await requireUser()
    if (r.error) return r.error
    const { user } = r

    if (!user.whatsappConnected || !user.whatsappPhoneNumberId) {
      return Response.json({ error: 'WhatsApp is not connected.' }, { status: 400 })
    }
    const accessToken = getDecryptedWhatsappAccessToken(user)
    if (!accessToken) {
      return Response.json(
        { error: 'Token missing. Disconnect WhatsApp and connect again with a new token.' },
        { status: 400 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const wabaIn = String(body?.whatsappBusinessAccountId || '').trim()
    if (!wabaIn || !/^\d+$/.test(wabaIn)) {
      return Response.json(
        {
          error:
            'Provide a numeric WhatsApp Business Account ID (WABA). This is not the Phone number ID and not the Facebook App ID.',
        },
        { status: 400 }
      )
    }
    if (wabaIn === String(user.whatsappPhoneNumberId)) {
      return Response.json(
        {
          error:
            'That value matches your Phone number ID. Templates use the separate WhatsApp Business Account ID from Business Manager.',
        },
        { status: 400 }
      )
    }

    try {
      await fetchWhatsAppBusinessAccountById({ accessToken, wabaId: wabaIn })
    } catch (e) {
      const status = e.status >= 400 && e.status < 600 ? e.status : 400
      return Response.json(
        { error: e.message || 'Meta could not load this ID as a WhatsApp Business Account.' },
        { status }
      )
    }

    const linked = await tryFetchWhatsappBusinessAccountLinkedToPhone({
      accessToken,
      phoneNumberId: user.whatsappPhoneNumberId,
    })

    if (linked && wabaIn !== linked) {
      return Response.json(
        {
          error:
            'This WABA is not the one Meta associates with your configured Phone number ID. Use the WABA linked to this number in Business settings → WhatsApp accounts.',
        },
        { status: 400 }
      )
    }

    user.whatsappBusinessAccountId = wabaIn
    await user.save()

    return Response.json({
      ok: true,
      whatsappBusinessAccountId: user.whatsappBusinessAccountId,
    })
  } catch (e) {
    console.error('whatsapp settings PATCH', e)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function DELETE() {
  try {
    const r = await requireUser()
    if (r.error) return r.error
    const { user } = r
    user.whatsappConnected = false
    user.whatsappPhoneNumberId = null
    user.whatsappBusinessAccountId = null
    user.whatsappDisplayPhone = null
    user.whatsappVerifiedName = null
    user.whatsappTokenCipher = null
    user.whatsappTokenIv = null
    user.whatsappTokenTag = null
    await user.save()
    return Response.json({ ok: true })
  } catch (e) {
    console.error('whatsapp settings DELETE', e)
    return new Response('Internal Server Error', { status: 500 })
  }
}
