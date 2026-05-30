import { describe, it, expect } from 'vitest'
import { computeAnalytics, checkTrend, allCheckNames } from '../analytics'
import type { ContractScanRecord } from '@/types/stellar'

function makeRecord(
  overrides: Partial<ContractScanRecord> & { findings?: ContractScanRecord['findings'] },
): ContractScanRecord {
  return {
    id: 'id-1',
    publicKey: 'GPUB',
    contractId: 'C1',
    network: 'testnet',
    scannedAt: '2024-01-01T00:00:00Z',
    findingCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    findings: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// computeAnalytics
// ---------------------------------------------------------------------------
describe('computeAnalytics', () => {
  it('returns zero values for empty records', () => {
    const result = computeAnalytics([])
    expect(result).toEqual({
      totalScans: 0,
      avgScore: 0,
      topChecks: [],
      totalFindings: { high: 0, medium: 0, low: 0 },
    })
  })

  it('counts totalScans correctly', () => {
    const records = [makeRecord({}), makeRecord({ id: 'id-2' })]
    expect(computeAnalytics(records).totalScans).toBe(2)
  })

  it('computes avgScore as average of findingCount', () => {
    const records = [
      makeRecord({ findingCount: 10 }),
      makeRecord({ id: 'id-2', findingCount: 20 }),
    ]
    expect(computeAnalytics(records).avgScore).toBe(15)
  })

  it('rounds avgScore', () => {
    const records = [
      makeRecord({ findingCount: 1 }),
      makeRecord({ id: 'id-2', findingCount: 2 }),
    ]
    // (1+2)/2 = 1.5 → rounds to 2
    expect(computeAnalytics(records).avgScore).toBe(2)
  })

  it('sums high/medium/low counts across records', () => {
    const records = [
      makeRecord({ highCount: 1, mediumCount: 2, lowCount: 3 }),
      makeRecord({ id: 'id-2', highCount: 4, mediumCount: 5, lowCount: 6 }),
    ]
    expect(computeAnalytics(records).totalFindings).toEqual({ high: 5, medium: 7, low: 9 })
  })

  it('returns top 5 checks sorted by frequency', () => {
    const findings = (name: string, n: number) =>
      Array.from({ length: n }, () => ({
        severity: 'high',
        check_name: name,
        description: '',
        function_name: '',
        file_path: '',
        line: 0,
      }))

    const records = [
      makeRecord({
        findings: [
          ...findings('A', 3),
          ...findings('B', 5),
          ...findings('C', 1),
          ...findings('D', 4),
          ...findings('E', 2),
          ...findings('F', 6),
        ],
      }),
    ]

    const { topChecks } = computeAnalytics(records)
    expect(topChecks).toHaveLength(5)
    expect(topChecks[0]).toEqual({ name: 'F', count: 6 })
    expect(topChecks[1]).toEqual({ name: 'B', count: 5 })
    expect(topChecks[4]).toEqual({ name: 'E', count: 2 })
  })
})

// ---------------------------------------------------------------------------
// checkTrend
// ---------------------------------------------------------------------------
describe('checkTrend', () => {
  it('returns empty array for empty records', () => {
    expect(checkTrend([], 'overflow')).toEqual([])
  })

  it('counts occurrences of a check per day', () => {
    const records = [
      makeRecord({
        scannedAt: '2024-01-01T10:00:00Z',
        findings: [
          { severity: 'high', check_name: 'overflow', description: '', function_name: '', file_path: '', line: 0 },
          { severity: 'high', check_name: 'overflow', description: '', function_name: '', file_path: '', line: 0 },
        ],
      }),
      makeRecord({
        id: 'id-2',
        scannedAt: '2024-01-02T10:00:00Z',
        findings: [
          { severity: 'high', check_name: 'overflow', description: '', function_name: '', file_path: '', line: 0 },
        ],
      }),
    ]

    const trend = checkTrend(records, 'overflow')
    expect(trend).toEqual([
      { date: '2024-01-01', count: 2 },
      { date: '2024-01-02', count: 1 },
    ])
  })

  it('returns zero count for days where check does not appear', () => {
    const records = [
      makeRecord({
        scannedAt: '2024-01-01T00:00:00Z',
        findings: [
          { severity: 'low', check_name: 'other', description: '', function_name: '', file_path: '', line: 0 },
        ],
      }),
    ]

    const trend = checkTrend(records, 'overflow')
    expect(trend).toEqual([{ date: '2024-01-01', count: 0 }])
  })

  it('sorts results by date ascending', () => {
    const records = [
      makeRecord({ id: 'id-2', scannedAt: '2024-01-03T00:00:00Z', findings: [] }),
      makeRecord({ scannedAt: '2024-01-01T00:00:00Z', findings: [] }),
    ]

    const trend = checkTrend(records, 'overflow')
    expect(trend[0].date).toBe('2024-01-01')
    expect(trend[1].date).toBe('2024-01-03')
  })
})

// ---------------------------------------------------------------------------
// allCheckNames
// ---------------------------------------------------------------------------
describe('allCheckNames', () => {
  it('returns empty array for empty records', () => {
    expect(allCheckNames([])).toEqual([])
  })

  it('returns unique check names sorted alphabetically', () => {
    const records = [
      makeRecord({
        findings: [
          { severity: 'high', check_name: 'reentrancy', description: '', function_name: '', file_path: '', line: 0 },
          { severity: 'high', check_name: 'overflow', description: '', function_name: '', file_path: '', line: 0 },
        ],
      }),
      makeRecord({
        id: 'id-2',
        findings: [
          { severity: 'low', check_name: 'overflow', description: '', function_name: '', file_path: '', line: 0 },
          { severity: 'low', check_name: 'access-control', description: '', function_name: '', file_path: '', line: 0 },
        ],
      }),
    ]

    expect(allCheckNames(records)).toEqual(['access-control', 'overflow', 'reentrancy'])
  })
})
