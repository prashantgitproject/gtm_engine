import crypto from 'crypto'

function getEncryptionKey() {
  const secret = process.env.SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('Missing SECRET/NEXTAUTH_SECRET for token encryption.')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptLinkedinToken(plainTextToken) {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(String(plainTextToken), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return {
    cipherText: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

export function decryptLinkedinToken(payload) {
  if (!payload?.cipherText || !payload?.iv || !payload?.tag) return null
  const key = getEncryptionKey()
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.iv, 'base64')
  )
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
  const dec = Buffer.concat([
    decipher.update(Buffer.from(payload.cipherText, 'base64')),
    decipher.final(),
  ])
  return dec.toString('utf8')
}
