import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import { app } from './index.js'

let server: ReturnType<typeof app.listen>
let origin = ''

beforeAll(async () => {
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve) })
  const { port } = server.address() as AddressInfo
  origin = `http://127.0.0.1:${port}`
})
afterAll(() => server.close())

describe('FraudShield server safety boundary', () => {
  it('reports capabilities without exposing credentials', async () => {
    const response = await fetch(`${origin}/api/health`)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ africaTalking: false, voice: false, llm: false })
  })

  it('rejects unapproved/free-form notification payloads', async () => {
    const response = await fetch(`${origin}/api/notifications/sms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: '+254711234567', message: 'arbitrary text' }) })
    expect(response.status).toBe(400)
  })

  it('returns grounded deterministic analyst guidance without an LLM key', async () => {
    const response = await fetch(`${origin}/api/analyst/query`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: 'Why was this flagged?', score: 94, evidence: ['Recent SIM replacement', 'Unseen device'] }) })
    const result = await response.json() as { mode: string; answer: string }
    expect(result.mode).toBe('deterministic')
    expect(result.answer).toContain('not a final fraud determination')
  })
})
