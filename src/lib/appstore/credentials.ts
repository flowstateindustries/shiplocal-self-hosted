/**
 * App Store Connect credentials loaded from environment variables.
 * For self-hosted use: set ASC_ISSUER_ID, ASC_KEY_ID, and ASC_PRIVATE_KEY
 * in .env.local. The private key's newlines may be encoded as the
 * literal `\n` sequence — they are converted back to real newlines here.
 */

export interface ASCCredentials {
  issuerId: string
  keyId: string
  privateKey: string
}

function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, '\n').trim()
}

export function getASCCredentials(): ASCCredentials | null {
  const issuerId = process.env.ASC_ISSUER_ID?.trim()
  const keyId = process.env.ASC_KEY_ID?.trim()
  const privateKeyRaw = process.env.ASC_PRIVATE_KEY

  if (!issuerId || !keyId || !privateKeyRaw) return null

  const privateKey = normalizePrivateKey(privateKeyRaw)
  if (!privateKey) return null

  return { issuerId, keyId, privateKey }
}

export function hasASCCredentials(): boolean {
  return getASCCredentials() !== null
}
