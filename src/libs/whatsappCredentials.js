import { decryptLinkedinToken } from '@/libs/linkedinTokenCrypto'

/**
 * @param {Record<string, unknown>} user Mongoose user document
 * @returns {string|null}
 */
export function getDecryptedWhatsappAccessToken(user) {
  if (!user?.whatsappTokenCipher || !user?.whatsappTokenIv || !user?.whatsappTokenTag) {
    return null
  }
  return decryptLinkedinToken({
    cipherText: user.whatsappTokenCipher,
    iv: user.whatsappTokenIv,
    tag: user.whatsappTokenTag,
  })
}
