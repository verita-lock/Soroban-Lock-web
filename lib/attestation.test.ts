import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildScanHash,
  strKeyDecode,
  buildPaymentXdr,
  attestScan,
} from './attestation'
import { signTransaction } from '@/lib/wallet'
import type { StellarNetwork } from '@/types/stellar'

vi.mock('@/lib/wallet', () => ({
  signTransaction: vi.fn(),
}))

const mockNetwork: StellarNetwork = {
  name: 'testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
}

describe('attestation helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  describe('buildScanHash', () => {
    it('should compute the SHA-256 hash of contractId + findingsJson and return as hex string', async () => {
      const contractId = 'CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM'
      const findingsJson = '[]'
      const hash = await buildScanHash(contractId, findingsJson)
      
      expect(hash).toHaveLength(64) // 32 bytes as hex
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
      
      const hash2 = await buildScanHash(contractId, findingsJson)
      expect(hash).toBe(hash2)
    })
  })

  describe('strKeyDecode', () => {
    it('should decode a valid Stellar G-address to a 32-byte public key', () => {
      const address = 'GBRPGEPDTAFBHESHIJZG56KZEXIUKERKWDNSQNUX47DILGAQD6C5NX3V'
      const decoded = strKeyDecode(address)
      expect(decoded).toBeInstanceOf(Uint8Array)
      expect(decoded.length).toBe(32)
    })

    it('should throw an error for invalid characters', () => {
      expect(() => strKeyDecode('invalid-char-address-1-0-8-9')).toThrow()
    })
  })

  describe('buildPaymentXdr', () => {
    it('should construct a valid base64 XDR string for payment-to-self', () => {
      const publicKey = 'GBRPGEPDTAFBHESHIJZG56KZEXIUKERKWDNSQNUX47DILGAQD6C5NX3V'
      const sequence = 12345n
      const memoHashBytes = new Uint8Array(32).fill(1)
      
      const xdr = buildPaymentXdr(publicKey, sequence, memoHashBytes, mockNetwork.networkPassphrase)
      
      expect(typeof xdr).toBe('string')
      expect(xdr.length).toBeGreaterThan(0)
      expect(xdr).toMatch(/^[A-Za-z0-9+/=]+$/)
    })
  })

  describe('attestScan', () => {
    it('should submit scan attestation transaction successfully', async () => {
      const publicKey = 'GBRPGEPDTAFBHESHIJZG56KZEXIUKERKWDNSQNUX47DILGAQD6C5NX3V'
      const contractId = 'CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM'
      const findingsJson = '[]'

      const mockAccountRes = {
        sequence: '100',
      }
      
      const mockSubmitRes = {
        hash: 'mock_tx_hash_98765',
      }

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockAccountRes,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockSubmitRes,
        } as Response)

      vi.mocked(signTransaction).mockResolvedValueOnce('mock_signed_xdr_payload')

      const result = await attestScan(publicKey, contractId, findingsJson, mockNetwork)

      expect(result).toEqual({
        txHash: 'mock_tx_hash_98765',
        explorerUrl: 'https://stellar.expert/explorer/testnet/tx/mock_tx_hash_98765',
      })

      expect(fetch).toHaveBeenNthCalledWith(
        1,
        `${mockNetwork.horizonUrl}/accounts/${publicKey}`
      )

      expect(signTransaction).toHaveBeenCalled()

      expect(fetch).toHaveBeenNthCalledWith(
        2,
        `${mockNetwork.horizonUrl}/transactions`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'tx=mock_signed_xdr_payload',
        })
      )
    })

    it('should throw an error if account details fetch fails', async () => {
      const publicKey = 'GBRPGEPDTAFBHESHIJZG56KZEXIUKERKWDNSQNUX47DILGAQD6C5NX3V'
      const contractId = 'CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM'
      const findingsJson = '[]'

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      await expect(
        attestScan(publicKey, contractId, findingsJson, mockNetwork)
      ).rejects.toThrow('Failed to fetch account details. Make sure the account is funded.')
    })

    it('should throw an error if transaction signing is rejected', async () => {
      const publicKey = 'GBRPGEPDTAFBHESHIJZG56KZEXIUKERKWDNSQNUX47DILGAQD6C5NX3V'
      const contractId = 'CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM'
      const findingsJson = '[]'

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ sequence: '100' }),
      } as Response)

      vi.mocked(signTransaction).mockResolvedValueOnce(null)

      await expect(
        attestScan(publicKey, contractId, findingsJson, mockNetwork)
      ).rejects.toThrow('Transaction was rejected or Freighter is not available.')
    })

    it('should throw an error if transaction submission fails', async () => {
      const publicKey = 'GBRPGEPDTAFBHESHIJZG56KZEXIUKERKWDNSQNUX47DILGAQD6C5NX3V'
      const contractId = 'CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM'
      const findingsJson = '[]'

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ sequence: '100' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({
            detail: 'Transaction simulation failed',
            extras: { result_codes: { transaction: 'tx_bad_seq' } },
          }),
        } as Response)

      vi.mocked(signTransaction).mockResolvedValueOnce('mock_signed_xdr')

      await expect(
        attestScan(publicKey, contractId, findingsJson, mockNetwork)
      ).rejects.toThrow('Transaction failed: tx_bad_seq')
    })
  })
})
