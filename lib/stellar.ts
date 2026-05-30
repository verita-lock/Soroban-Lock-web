/**
 * Stellar / Soroban blockchain integration helpers.
 *
 * Uses the Horizon REST API and Soroban RPC to:
 *  - Resolve a contract ID to its WASM source via Horizon
 *  - Fetch contract WASM bytecode from Soroban RPC
 *  - Validate Stellar public keys (G-addresses)
 *  - Validate Soroban contract IDs (C-addresses)
 */

import type { ContractInfo, StellarNetwork } from '@/types/stellar'

// ── Key / address validation ──────────────────────────────────────────────────

const G_ADDRESS_RE = /^G[A-Z2-7]{55}$/
const C_ADDRESS_RE = /^C[A-Z2-7]{55}$/

/**
 * Check whether a string is a valid Stellar public key (G-address).
 * @param key - String to validate
 * @returns True if the key matches the G-address format
 */
export function isValidPublicKey(key: string): boolean {
  return G_ADDRESS_RE.test(key)
}

/**
 * Check whether a string is a valid Soroban contract ID (C-address).
 * @param id - String to validate
 * @returns True if the id matches the C-address format
 */
export function isValidContractId(id: string): boolean {
  return C_ADDRESS_RE.test(id)
}

/**
 * Extract a Soroban contract ID (C-address) from a URL or plain string.
 * Handles URLs like https://stellar.expert/explorer/testnet/contract/CABC...
 * Returns the contract ID if found, or null.
 */
export function extractContractIdFromUrl(input: string): string | null {
  // Already a bare C-address
  if (C_ADDRESS_RE.test(input.trim())) return input.trim()
  // Try to extract from a URL path segment
  const match = input.match(/\b(C[A-Z2-7]{55})\b/)
  return match ? match[1] : null
}

// ── Horizon helpers ───────────────────────────────────────────────────────────

/**
 * Fetch basic contract metadata from Horizon.
 * Returns null if the contract does not exist on the given network.
 */
export async function fetchContractInfo(
  contractId: string,
  network: StellarNetwork,
): Promise<ContractInfo | null> {
  if (!isValidContractId(contractId)) return null

  const url = `${network.horizonUrl}/contracts/${contractId}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })

  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Horizon error ${res.status}: ${await res.text()}`)

  const data = (await res.json()) as Record<string, string | undefined>
  return {
    contractId,
    wasmHash: data.wasm_id ?? data.wasm_hash ?? '',
    network: network.name,
    createdAt: data.paging_token ?? undefined,
  }
}

// ── Soroban RPC helpers ───────────────────────────────────────────────────────

interface RpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params: unknown
}

async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown,
): Promise<T> {
  const body: RpcRequest = { jsonrpc: '2.0', id: 1, method, params }
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`RPC HTTP error ${res.status}`)
  const json = (await res.json()) as { error?: { message: string }; result?: unknown }
  if (json.error) throw new Error(`RPC error: ${json.error.message}`)
  return json.result as T
}

/**
 * Fetch the WASM bytecode for a contract from Soroban RPC.
 * Returns the hex-encoded WASM string, or null if not found.
 */
export async function fetchContractWasm(
  contractId: string,
  network: StellarNetwork,
): Promise<string | null> {
  if (!isValidContractId(contractId)) return null

  try {
    const result = await rpcCall<{ wasm: string }>(
      network.sorobanRpcUrl,
      'getContractWasm',
      { contract_id: contractId },
    )
    return result.wasm ?? null
  } catch {
    return null
  }
}

/**
 * Fetch the ledger entry for a contract's code (WASM hash).
 * Uses getLedgerEntries RPC method.
 */
export async function fetchContractCode(
  wasmHash: string,
  network: StellarNetwork,
): Promise<string | null> {
  if (!wasmHash) return null

  try {
    // XDR key for ContractCode ledger entry — base64 encoded
    // In practice the caller would build the XDR key; here we use the hash directly
    const result = await rpcCall<{ entries: Array<{ xdr: string }> }>(
      network.sorobanRpcUrl,
      'getLedgerEntries',
      { keys: [wasmHash] },
    )
    return result.entries?.[0]?.xdr ?? null
  } catch {
    return null
  }
}

// ── Network health ────────────────────────────────────────────────────────────

/**
 * Check whether the Horizon API for a given network is reachable.
 * @param network - The Stellar network to check
 * @returns True if the network responded within 5 seconds
 */
export async function checkNetworkHealth(network: StellarNetwork): Promise<boolean> {
  try {
    const res = await fetch(`${network.horizonUrl}/`, {
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── Account contract lookup ───────────────────────────────────────────────────

/**
 * Fetch a list of contract IDs associated with a Stellar account.
 * Uses Horizon's /accounts/{id}/data endpoint to find contract references.
 * Returns an empty array if none are found or on error.
 */
export async function fetchContractsByAccount(
  accountId: string,
  network: StellarNetwork,
): Promise<string[]> {
  if (!isValidPublicKey(accountId)) return []

  try {
    const url = `${network.horizonUrl}/accounts/${accountId}/data`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = (await res.json()) as { _embedded?: { records?: Array<{ key: string; value: string }> } }
    const records = data._embedded?.records ?? []
    return records
      .map(r => atob(r.value))
      .filter(v => C_ADDRESS_RE.test(v))
  } catch {
    return []
  }
}

/**
 * Fetch contract metadata including WASM hash, creation date, and creator.
 * Note: Creator is not available via current APIs and will return null.
 * Creation date is derived from the contract's creation ledger via Soroban RPC and Horizon.
 */
export async function fetchContractMetadata(
  contractId: string,
  network: StellarNetwork,
): Promise<{ wasmHash: string; createdAt: string | null; creator: string | null }> {
  if (!isValidContractId(contractId)) {
    return { wasmHash: '', createdAt: null, creator: null }
  }

  let wasmHash: string | null = null
  let creationLedger: number | null = null

  try {
    const result = await rpcCall<{
      contract_id: string
      wasm_hash: string
      creation_ledger: number
    }>(
      network.sorobanRpcUrl,
      'getContractInfo',
      { contract_id: contractId }
    )
    wasmHash = result.wasm_hash
    creationLedger = result.creation_ledger
  } catch (e) {
    // If we fail to get the contract info via Soroban RPC, return empty
    return { wasmHash: '', createdAt: null, creator: null }
  }

  let createdAt: string | null = null
  if (creationLedger !== null) {
    try {
      const ledgerUrl = `${network.horizonUrl}/ledgers/${creationLedger}`
      const ledgerRes = await fetch(ledgerUrl)
      if (ledgerRes.ok) {
        const ledgerData = await ledgerRes.json()
        createdAt = ledgerData.closed_at // ISO 8601 string
      }
    } catch (e) {
      // Leave createdAt as null if we fail to fetch ledger details
    }
  }

  return {
    wasmHash: wasmHash ?? '',
    createdAt,
    creator: null, // Creator information is not available via current APIs
  }
}