import crypto from 'crypto'
import { getServerSession } from 'next-auth'
import { cookies } from 'next/headers'
import authOptions from '@/app/auth/options'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 })
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID
  if (!clientId) {
    return Response.redirect(new URL('/settings?linkedin=missing_client_id', request.url))
  }

  const state = crypto.randomBytes(24).toString('hex')
  cookies().set('linkedin_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  })

  const base =
    process.env.NEXT_PUBLIC_URL ||
    process.env.NEXTAUTH_URL ||
    new URL(request.url).origin
  const redirectUri = `${base}/api/settings/linkedin/callback`
  const scope = 'openid profile email w_member_social'
  const url = new URL('https://www.linkedin.com/oauth/v2/authorization')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('scope', scope)

  return Response.redirect(url)
}
