import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { addSchedule, removeSchedule, getDueScans, markRan, getSchedule, getAllSchedules } from '../schedule'

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------
const store: Record<string, string> = {}

const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { Object.keys(store).forEach(k => delete store[k]) },
}

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

beforeEach(() => {
  localStorageMock.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// addSchedule
// ---------------------------------------------------------------------------
describe('addSchedule', () => {
  it('adds a new schedule with lastRun null', () => {
    addSchedule('C1', 'testnet', 'daily')
    const schedule = getSchedule('C1', 'testnet')
    expect(schedule).toEqual({ contractId: 'C1', network: 'testnet', interval: 'daily', lastRun: null })
  })

  it('updates interval if schedule already exists', () => {
    addSchedule('C1', 'testnet', 'daily')
    addSchedule('C1', 'testnet', 'weekly')
    expect(getSchedule('C1', 'testnet')?.interval).toBe('weekly')
    expect(getAllSchedules()).toHaveLength(1)
  })

  it('treats different networks as separate schedules', () => {
    addSchedule('C1', 'testnet', 'daily')
    addSchedule('C1', 'mainnet', 'weekly')
    expect(getAllSchedules()).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// removeSchedule
// ---------------------------------------------------------------------------
describe('removeSchedule', () => {
  it('removes an existing schedule', () => {
    addSchedule('C1', 'testnet', 'daily')
    removeSchedule('C1', 'testnet')
    expect(getSchedule('C1', 'testnet')).toBeNull()
  })

  it('does nothing when schedule does not exist', () => {
    addSchedule('C1', 'testnet', 'daily')
    removeSchedule('C2', 'testnet') // different contract
    expect(getAllSchedules()).toHaveLength(1)
  })

  it('only removes the matching contract+network pair', () => {
    addSchedule('C1', 'testnet', 'daily')
    addSchedule('C2', 'testnet', 'weekly')
    removeSchedule('C1', 'testnet')
    expect(getSchedule('C2', 'testnet')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getDueScans
// ---------------------------------------------------------------------------
describe('getDueScans', () => {
  it('returns all schedules when lastRun is null', () => {
    addSchedule('C1', 'testnet', 'daily')
    addSchedule('C2', 'testnet', 'weekly')
    expect(getDueScans()).toHaveLength(2)
  })

  it('returns daily schedule after 24 hours have passed', () => {
    const now = new Date('2024-06-01T12:00:00Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(now)

    addSchedule('C1', 'testnet', 'daily')
    markRan('C1', 'testnet')

    // Advance time by 25 hours
    vi.setSystemTime(now + 25 * 60 * 60 * 1000)
    expect(getDueScans()).toHaveLength(1)
  })

  it('does not return daily schedule before 24 hours have passed', () => {
    const now = new Date('2024-06-01T12:00:00Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(now)

    addSchedule('C1', 'testnet', 'daily')
    markRan('C1', 'testnet')

    // Advance time by only 12 hours
    vi.setSystemTime(now + 12 * 60 * 60 * 1000)
    expect(getDueScans()).toHaveLength(0)
  })

  it('returns weekly schedule after 7 days have passed', () => {
    const now = new Date('2024-06-01T12:00:00Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(now)

    addSchedule('C1', 'testnet', 'weekly')
    markRan('C1', 'testnet')

    // Advance time by 8 days
    vi.setSystemTime(now + 8 * 24 * 60 * 60 * 1000)
    expect(getDueScans()).toHaveLength(1)
  })

  it('does not return weekly schedule before 7 days have passed', () => {
    const now = new Date('2024-06-01T12:00:00Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(now)

    addSchedule('C1', 'testnet', 'weekly')
    markRan('C1', 'testnet')

    // Advance time by 3 days
    vi.setSystemTime(now + 3 * 24 * 60 * 60 * 1000)
    expect(getDueScans()).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// markRan
// ---------------------------------------------------------------------------
describe('markRan', () => {
  it('sets lastRun to current ISO timestamp', () => {
    const now = new Date('2024-06-01T12:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    addSchedule('C1', 'testnet', 'daily')
    markRan('C1', 'testnet')

    expect(getSchedule('C1', 'testnet')?.lastRun).toBe(now.toISOString())
  })

  it('does nothing when schedule does not exist', () => {
    // Should not throw
    expect(() => markRan('nonexistent', 'testnet')).not.toThrow()
  })

  it('updates lastRun on subsequent calls', () => {
    const t1 = new Date('2024-06-01T12:00:00Z')
    const t2 = new Date('2024-06-02T12:00:00Z')
    vi.useFakeTimers()

    addSchedule('C1', 'testnet', 'daily')

    vi.setSystemTime(t1)
    markRan('C1', 'testnet')
    expect(getSchedule('C1', 'testnet')?.lastRun).toBe(t1.toISOString())

    vi.setSystemTime(t2)
    markRan('C1', 'testnet')
    expect(getSchedule('C1', 'testnet')?.lastRun).toBe(t2.toISOString())
  })
})
