import mongoose from 'mongoose'
import { getServerSession } from 'next-auth'
import authOptions from '@/app/auth/options'
import { User } from '@/models/User'

export const dynamic = 'force-dynamic'

async function getCurrentUser() {
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
    const result = await getCurrentUser()
    if (result.error) return result.error
    const { user } = result
    return Response.json({
      connected: Boolean(user.linkedinConnected),
      expiresAt: user.linkedinTokenExpiresAt || null,
      hasEncryptedToken: Boolean(
        user.linkedinTokenCipher && user.linkedinTokenIv && user.linkedinTokenTag
      ),
      linkupAccountId: user.linkupAccountId || null,
    })
  } catch (e) {
    console.error('linkedin status error', e)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function DELETE() {
  try {
    const result = await getCurrentUser()
    if (result.error) return result.error
    const { user } = result
    user.linkedinConnected = false
    user.linkedinTokenCipher = null
    user.linkedinTokenIv = null
    user.linkedinTokenTag = null
    user.linkedinTokenExpiresAt = null
    user.linkupAccountId = null
    await user.save()
    return Response.json({ ok: true })
  } catch (e) {
    console.error('linkedin disconnect error', e)
    return new Response('Internal Server Error', { status: 500 })
  }
}
