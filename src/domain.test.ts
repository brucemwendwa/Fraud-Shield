import { describe, expect, it } from 'vitest'
import { severityForScore, stageForEvents } from './domain'

describe('risk classification', () => {
  it('maps each score threshold to the correct analyst severity', () => {
    expect(severityForScore(0)).toBe('LOW')
    expect(severityForScore(39)).toBe('LOW')
    expect(severityForScore(40)).toBe('MEDIUM')
    expect(severityForScore(70)).toBe('HIGH')
    expect(severityForScore(90)).toBe('CRITICAL')
  })

  it('moves through the attack chain as correlated events accumulate', () => {
    expect(stageForEvents(0)).toBe('Early signal')
    expect(stageForEvents(5)).toBe('Social engineering')
    expect(stageForEvents(8)).toBe('Account takeover')
    expect(stageForEvents(20)).toBe('Mule detection')
  })
})
