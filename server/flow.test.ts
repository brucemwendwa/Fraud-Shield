import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import { app } from './index.js'

let server: ReturnType<typeof app.listen>
let origin = ''

beforeAll(async () => {
  await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve) })
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => server.close())

async function post(path: string, body?: unknown) {
  const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  return { response, data: await response.json() as any }
}
const fullChain = ['sim_swap', 'new_device', 'new_location', 'password_reset', 'new_beneficiary', 'airtime_purchase', 'large_transfer']

describe('automated fraud protection flow', () => {
  it('allows a normal low-risk transaction', async () => {
    await post('/api/demo/reset')
    const { response, data } = await post('/api/demo/transactions/normal')
    expect(response.status).toBe(200)
    expect(data.securityStatus).toBe('NORMAL')
    expect(data.transaction.status).toBe('NORMAL')
  })

  it('detects an attack chain and automatically blocks the transfer', async () => {
    await post('/api/demo/reset')
    let state: any
    for (const type of fullChain) ({ data: state } = await post('/api/demo/attack/step', { type }))
    expect(state.riskScore).toBe(94)
    expect(state.securityStatus).toBe('PROTECTED')
    expect(state.transaction.status).toBe('BLOCKED')
    expect(state.alert.active).toBe(true)
    expect(state.incident.status).toBe('OPEN')
    expect(state.inbox).toHaveLength(1)
    expect(state.inbox[0].kind).toBe('alert')
  })

  it('releases a verified transaction when the customer confirms YES', async () => {
    const { data } = await post('/api/demo/customer-decision', { decision: 'YES' })
    expect(data.riskScore).toBe(25)
    expect(data.securityStatus).toBe('NORMAL')
    expect(data.transaction.status).toBe('RELEASED')
    expect(data.incident.status).toBe('VERIFIED')
    expect(data.inbox[0]).toMatchObject({ kind: 'resolution', sender: 'FraudShield Security Team' })
    expect(data.inbox[0].body).toBe('ACTIVITY VERIFIED\nYour transaction has been released.')
  })

  it('keeps the account protected when the customer confirms NO', async () => {
    await post('/api/demo/reset')
    for (const type of fullChain) await post('/api/demo/attack/step', { type })
    const { data } = await post('/api/demo/customer-decision', { decision: 'NO' })
    expect(data.securityStatus).toBe('PROTECTED')
    expect(data.transaction.status).toBe('BLOCKED')
    expect(data.beneficiaryBlocked).toBe(true)
    expect(data.suspiciousDevice).toBe(true)
    expect(data.incident.status).toBe('PROTECTED')
    expect(data.inbox[0].body).toContain('ACCOUNT PROTECTED\nTransaction and beneficiary remain blocked.')
  })

  it('accepts a customer NO decision through the Africa’s Talking USSD callback', async () => {
    await post('/api/demo/reset')
    for (const type of fullChain) await post('/api/demo/attack/step', { type })
    const form = new URLSearchParams({ sessionId: 'test-session', serviceCode: '*123#', networkCode: '63902', phoneNumber: '0726867698', text: '' })
    const menu = await fetch(origin + '/api/ussd', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form })
    expect(await menu.text()).toContain('1. This was not me')
    const response = await fetch(origin + '/api/ussd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'test-session', serviceCode: '*123#', networkCode: '63902', phoneNumber: '+254726867698', text: '1' }) })
    expect(await response.text()).toContain('ACCOUNT PROTECTED')
    const state = await (await fetch(origin + '/api/demo/state')).json() as any
    expect(state.incident.customerDecision).toBe('NO')
    expect(state.securityStatus).toBe('PROTECTED')
  })
})
