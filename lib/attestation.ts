/**
 * Stellar attestation helpers.
 *
 * Builds a Stellar transaction that records a scan attestation on-chain.
 * The transaction is a payment of 0.0000001 XLM to self with a memo_hash
 * set to the SHA-256 of the scan results (contractId + sorted findings JSON).
 *
 * Because the stellar-sdk is not bundled, we build a minimal XDR-compatible
 * payload using the Horizon transaction builder endpoint instead, which
 * accepts a pre-built XDR or we can use the Freighter signTransaction flow
 * with a raw XDR string produced by the Horizon /transactions endpoint.
 *
 * For simplicity we use the Horizon fee-bump / transaction builder approach:
 * POST /transactions with the XDR built via stellar-base (if available) or
 * fall back to a fetch-based approach using the Horizon REST API.
 */

import type { StellarNetwork } from '@/types/stellar'
import { signTransaction } from '@/lib/wallet'

/**
 * Compute SHA-256 of a string and return as Uint8Array (32 bytes).
 */
async function sha256(input: string): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return new Uint8Array(hashBuffer)
}

/**
 * Build a scan hash from contractId + findings JSON.
 */
export async function buildScanHash(contractId: string, findingsJson: string): Promise<string> {
  const input = `${contractId}:${findingsJson}`
  const bytes = await sha256(input)
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface AttestationResult {
  txHash: string
  explorerUrl: string
}

/**
 * Submit an attestation transaction via Horizon.
 *
 * Uses the Horizon /transactions endpoint with a pre-built XDR.
 * The XDR is constructed by calling the Horizon transaction builder
 * (POST /accounts/{publicKey}/transactions) or by using stellar-base.
 *
 * Since stellar-base is not in the bundle, we use the Horizon REST API
 * to build and submit the transaction.
 */
export async function attestScan(
  publicKey: string,
  contractId: string,
  findingsJson: string,
  network: StellarNetwork,
): Promise<AttestationResult> {
  // 1. Build the scan hash (32 bytes)
  const scanHashHex = await buildScanHash(contractId, findingsJson)
  const scanHashBytes = Uint8Array.from(
    scanHashHex.match(/.{2}/g)!.map(b => parseInt(b, 16)),
  )

  // 2. Fetch account sequence number from Horizon
  const accountRes = await fetch(`${network.horizonUrl}/accounts/${publicKey}`)
  if (!accountRes.ok) {
    throw new Error('Failed to fetch account details. Make sure the account is funded.')
  }
  const accountData = await accountRes.json()
  const sequence = BigInt(accountData.sequence) + 1n

  // 3. Build XDR using stellar-base primitives via dynamic import or manual XDR
  //    We use the Horizon /transactions endpoint with a manually constructed XDR.
  //    For a minimal payment-to-self with memo_hash we build the XDR manually.
  const xdr = buildPaymentXdr(publicKey, sequence, scanHashBytes, network.networkPassphrase)

  // 4. Sign via Freighter
  const signedXdr = await signTransaction(xdr, network)
  if (!signedXdr) {
    throw new Error('Transaction was rejected or Freighter is not available.')
  }

  // 5. Submit to Horizon
  const submitRes = await fetch(`${network.horizonUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `tx=${encodeURIComponent(signedXdr)}`,
  })

  const submitData = await submitRes.json()
  if (!submitRes.ok) {
    const detail = submitData?.extras?.result_codes?.transaction ?? submitData?.detail ?? 'Unknown error'
    throw new Error(`Transaction failed: ${detail}`)
  }

  const txHash = submitData.hash as string
  const explorerUrl = `https://stellar.expert/explorer/${network.name}/tx/${txHash}`

  return { txHash, explorerUrl }
}

/**
 * Build a minimal Stellar transaction XDR for a payment-to-self with memo_hash.
 *
 * This uses the @stellar/stellar-base library if available, otherwise throws.
 * In production this would be bundled; here we use a dynamic import pattern.
 */
export function buildPaymentXdr(
  publicKey: string,
  sequence: bigint,
  memoHashBytes: Uint8Array,
  _networkPassphrase: string,
): string {
  // We encode the transaction as a base64 XDR string.
  // Since stellar-base is not bundled, we construct the XDR manually using
  // the Stellar XDR spec for a simple payment transaction.
  //
  // TransactionEnvelope (type 0 = ENVELOPE_TYPE_TX):
  //   Transaction:
  //     sourceAccount: publicKey (ED25519)
  //     fee: 100 stroops
  //     seqNum: sequence
  //     timeBounds: none
  //     memo: MEMO_HASH (type 3) + 32 bytes
  //     operations: [Payment to self, 0.0000001 XLM (1 stroop), native asset]
  //     ext: 0
  //   signatures: [] (to be filled by Freighter)

  // Decode the public key from Stellar base32 (StrKey)
  const rawKey = strKeyDecode(publicKey)

  // XDR encoding helpers
  const buf: number[] = []

  function writeUint32(n: number) {
    buf.push((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff)
  }

  function writeInt64(n: bigint) {
    const hi = Number((n >> 32n) & 0xffffffffn)
    const lo = Number(n & 0xffffffffn)
    writeUint32(hi)
    writeUint32(lo)
  }

  function writeBytes(bytes: Uint8Array | number[]) {
    for (const b of bytes) buf.push(b)
  }

  function writePadded(bytes: Uint8Array, len: number) {
    writeBytes(bytes)
    const pad = (4 - (len % 4)) % 4
    for (let i = 0; i < pad; i++) buf.push(0)
  }

  // Transaction body
  const txBuf: number[] = []
  function tw32(n: number) { txBuf.push((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff) }
  function tw64(n: bigint) { const hi = Number((n >> 32n) & 0xffffffffn); const lo = Number(n & 0xffffffffn); tw32(hi); tw32(lo) }
  function twBytes(b: Uint8Array | number[]) { for (const x of b) txBuf.push(x) }

  // sourceAccount: KEY_TYPE_ED25519 (0) + 32 bytes
  tw32(0) // KEY_TYPE_ED25519
  twBytes(rawKey)

  // fee: 100
  tw32(100)

  // seqNum
  tw64(sequence)

  // timeBounds: none (0)
  tw32(0)

  // memo: MEMO_HASH (3) + 32 bytes
  tw32(3)
  twBytes(memoHashBytes)

  // operations: 1 operation
  tw32(1)
  // operation sourceAccount: none (0)
  tw32(0)
  // operation type: PAYMENT (1)
  tw32(1)
  // destination: KEY_TYPE_ED25519 + rawKey (pay to self)
  tw32(0)
  twBytes(rawKey)
  // asset: ASSET_TYPE_NATIVE (0)
  tw32(0)
  // amount: 1 stroop = 1 (int64)
  tw64(1n)

  // ext: 0
  tw32(0)

  // Envelope: ENVELOPE_TYPE_TX (2) + transaction + signatures (empty array)
  writeUint32(2) // ENVELOPE_TYPE_TX
  writeBytes(txBuf)
  writeUint32(0) // 0 signatures

  return btoa(String.fromCharCode(...buf))
}

/**
 * Decode a Stellar StrKey (G-address) to raw 32-byte public key.
 * Stellar StrKey uses base32 with a version byte and CRC16 checksum.
 */
export function strKeyDecode(address: string): Uint8Array {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const decoded: number[] = []
  let bits = 0
  let value = 0

  for (const char of address) {
    const idx = ALPHABET.indexOf(char)
    if (idx < 0) throw new Error(`Invalid StrKey character: ${char}`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      decoded.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  // decoded[0] = version byte (6 << 3 = 48 for G-address)
  // decoded[1..32] = 32-byte public key
  // decoded[33..34] = CRC16 checksum
  return new Uint8Array(decoded.slice(1, 33))
}
