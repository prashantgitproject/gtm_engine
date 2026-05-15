import mongoose from 'mongoose'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import authOptions from '@/app/auth/options'
import { User } from '@/models/User'
import { encryptLinkedinToken } from '@/libs/linkedinTokenCrypto'
import { loginLinkedinToLinkup } from '@/libs/linkupApi'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const expectedState = cookies().get('linkedin_oauth_state')?.value
    cookies().delete('linkedin_oauth_state')

    if (error) {
      return Response.redirect(new URL(`/settings?linkedin=oauth_error`, origin))
    }
    if (!code || !state || !expectedState || state !== expectedState) {
      return Response.redirect(new URL('/settings?linkedin=state_mismatch', origin))
    }

    const clientId = process.env.LINKEDIN_CLIENT_ID
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return Response.redirect(new URL('/settings?linkedin=missing_config', origin))
    }

    const base = process.env.NEXT_PUBLIC_URL || process.env.NEXTAUTH_URL || origin
    const redirectUri = `${base}/api/settings/linkedin/callback`

    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
    })
    const tokenData = await tokenRes.json().catch(() => ({}))

    if (!tokenRes.ok || !tokenData?.access_token) {
      return Response.redirect(new URL('/settings?linkedin=token_failed', origin))
    }

    await mongoose.connect(process.env.MONGO_URL)
    const user = await User.findOne({ email: session.user.email })
    if (!user) {
      return new Response('User not found', { status: 404 })
    }

    const encrypted = encryptLinkedinToken(tokenData.access_token)
    user.linkedinTokenCipher = encrypted.cipherText
    user.linkedinTokenIv = encrypted.iv
    user.linkedinTokenTag = encrypted.tag
    user.linkedinConnected = true
    user.linkedinTokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
      : null

    const linkup = await loginLinkedinToLinkup({
      loginToken: tokenData.access_token,
      country: 'US',
    })
    if (!linkup.skipped && linkup.accountId) {
      user.linkupAccountId = linkup.accountId
    }
    await user.save()

    return Response.redirect(new URL('/settings?linkedin=connected', origin))
  } catch (e) {
    console.error('linkedin callback error', e)
    return Response.redirect(new URL('/settings?linkedin=failed', request.url))
  }
}
