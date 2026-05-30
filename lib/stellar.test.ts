import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isValidPublicKey,
  isValidContractId,
  extractContractIdFromUrl,
  fetchContractInfo,
} from './stellar'
import type { StellarNetwork } from '@/types/stellar'

const mockNetwork: StellarNetwork = {
  name: 'testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
}

describe('stellar helpers', () => {
  describe('isValidPublicKey', () => {
    it('should return true for valid G-addresses', () => {
      expect(isValidPublicKey('GBRPGEPDTAFBHESHIJZG56KZEXIUKERKWDNSQNUX47DILGAQD6C5NX3V')).toBe(true)
      expect(isValidPublicKey('GA5W327WXSS6Z3CH5B24TUT75HGDF2GZA63BNWPZSP27JYWMCACUD4UM')).toBe(true)
    })

    it('should return false for invalid G-addresses', () => {
      expect(isValidPublicKey('GBRPGEP')).toBe(false)
      expect(isValidPublicKey('CBRPGEPDTAFBHESHIJZG56KZEXIUKERKWDNSQNUX47DILGAQD6C5NX3V')).toBe(false)
      expect(isValidPublicKey('GBRPGEPDTAFBHESHIJZG56KZEXIUKERKWDNSQNUX47DILGAQD6C5NX38')).toBe(false)
    })
  })

  describe('isValidContractId', () => {
    it('should return true for valid C-addresses', () => {
      expect(isValidContractId('CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM')).toBe(true)
    })

    it('should return false for invalid C-addresses', () => {
      expect(isValidContractId('CA3D5AJ')).toBe(false)
      expect(isValidContractId('GA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM')).toBe(false)
      expect(isValidContractId('CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOW8')).toBe(false)
    })
  })

  describe('extractContractIdFromUrl', () => {
    it('should extract bare contract ID', () => {
      const id = 'CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM'
      expect(extractContractIdFromUrl(id)).toBe(id)
      expect(extractContractIdFromUrl(`  ${id}  `)).toBe(id.trim())
    })

    it('should extract contract ID from Stellar.expert URL', () => {
      const id = 'CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM'
      const url = `https://stellar.expert/explorer/testnet/contract/${id}`
      expect(extractContractIdFromUrl(url)).toBe(id)
    })

    it('should extract contract ID from any path segment', () => {
      const id = 'CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM'
      expect(extractContractIdFromUrl(`/contracts/${id}/details`)).toBe(id)
    })

    it('should return null for invalid inputs', () => {
      expect(extractContractIdFromUrl('not-a-contract-id')).toBeNull()
      expect(extractContractIdFromUrl('https://stellar.expert/explorer/testnet')).toBeNull()
    })
  })

  describe('fetchContractInfo', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    it('should return null immediately if contract ID is invalid', async () => {
      const result = await fetchContractInfo('invalid', mockNetwork)
      expect(result).toBeNull()
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should fetch contract info successfully', async () => {
      const id = 'CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM'
      const mockResponse = {
        wasm_id: 'mock_wasm_hash_123',
        paging_token: '123456',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      const result = await fetchContractInfo(id, mockNetwork)
      expect(fetch).toHaveBeenCalledWith(
        `${mockNetwork.horizonUrl}/contracts/${id}`,
        { headers: { Accept: 'application/json' } }
      )
      expect(result).toEqual({
        contractId: id,
        wasmHash: 'mock_wasm_hash_123',
        network: mockNetwork.name,
        createdAt: '123456',
      })
    })

    it('should support wasm_hash fallback', async () => {
      const id = 'CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM'
      const mockResponse = {
        wasm_hash: 'fallback_wasm_hash',
      }

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response)

      const result = await fetchContractInfo(id, mockNetwork)
      expect(result?.wasmHash).toBe('fallback_wasm_hash')
    })

    it('should return null on 404', async () => {
      const id = 'CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM'
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      const result = await fetchContractInfo(id, mockNetwork)
      expect(result).toBeNull()
    })

    it('should throw an error on other HTTP failures', async () => {
      const id = 'CA3D5AJVU6KMZFPNDSBAZZVVW5FBKV3EE7UXMPEGCFDGBZJAS75BAOWM'
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response)

      await expect(fetchContractInfo(id, mockNetwork)).rejects.toThrow('Horizon error 500: Internal Server Error')
    })
  })
})
