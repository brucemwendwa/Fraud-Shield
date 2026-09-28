import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { z } from 'zod'

export const app = express()
app.use(cors())
app.use(express.json({ limit: '64kb' }))
// Africa's Talking USSD callbacks are commonly submitted as form data rather than JSON.
app.use(express.urlencoded({ extended: false, limit: '64kb' }))

const history = new Map<string, number[]>()
function limit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.ip ?? 'local'; const now = Date.now()
  const recent = (history.get(key) ?? []).filter((stamp) => now - stamp < 60_000)
  if (recent.length >= 20) return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' })
  recent.push(now); history.set(key, recent); next()
}
function configured() { return Boolean(process.env.AT_USERNAME && process.env.AT_API_KEY) }
function stamp() { return new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) }
function id(prefix: string) { return prefix + '-' + crypto.randomUUID().slice(0, 8).toUpperCase() }

const users = [
  { id: 'cus-001245', name: 'Brian Otieno', initials: 'BO', role: 'customer', email: 'brian.otieno@fraudshield.demo', permissions: ['customer-dashboard', 'fraud-dna'] },
  { id: 'adm-001', name: 'Grace Wanjiku', initials: 'GW', role: 'admin', email: 'grace.admin@fraudshield.demo', permissions: ['admin-dashboard', 'threats', 'simulator', 'fraud-dna', 'integrations'] },
]
const eventDefinitions = {
  sim_swap: { title: 'SIM swap detected', detail: 'A replacement SIM was activated for +254 726 867 698.', contribution: 30 },
  new_device: { title: 'New device detected', detail: 'An untrusted Android device accessed the account.', contribution: 19 },
  new_location: { title: 'New location detected', detail: 'Activity moved outside Brian’s recent Nairobi pattern.', contribution: 17 },
  password_reset: { title: 'Password reset detected', detail: 'A sensitive account action followed the SIM change.', contribution: 6 },
  new_beneficiary: { title: 'New beneficiary created', detail: 'A new recipient was added during the high-risk session.', contribution: 14 },
  airtime_purchase: { title: 'Suspicious airtime purchase', detail: 'An unusual airtime purchase exceeded the normal pattern.', contribution: 7 },
  large_transfer: { title: 'KSh 75,000 transfer attempted', detail: 'Transaction was stopped before money left the account.', contribution: 20 },
} as const
type AttackEventType = keyof typeof eventDefinitions
const attackOrder: AttackEventType[] = ['sim_swap', 'new_device', 'new_location', 'password_reset', 'new_beneficiary', 'airtime_purchase', 'large_transfer']

function initialState() {
  return {
    customer: { id: 'cus-001245', name: 'Brian Otieno', phone: '+254 726 867 698', account: 'FS-001245', balance: 128450, device: 'Samsung Galaxy S24', location: 'Nairobi, Kenya' },
    securityStatus: 'NORMAL', riskScore: 12,
    transaction: { id: 'TXN-75000', amount: 75000, recipient: '+254 701 XXX XXX', time: '—', location: 'Nairobi', status: 'NORMAL', risk: 12 },
    events: [] as Array<{ id: string; type: AttackEventType | 'protection' | 'customer_decision'; time: string; title: string; detail: string; contribution: number }>,
    alert: null as null | { active: boolean; delivered: boolean; mode: 'sandbox' | 'connected'; message: string },
    inbox: [] as Array<{ id: string; sender: string; body: string; time: string; kind: 'alert' | 'resolution' }>,
    incident: null as null | { id: string; customerId: string; riskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; triggerEvents: string[]; blockedActions: string[]; customerDecision: 'YES' | 'NO' | null; status: 'OPEN' | 'VERIFIED' | 'PROTECTED'; createdAt: string; resolvedAt: string | null },
    suspiciousDevice: false, suspiciousSim: false, beneficiaryBlocked: false, highRiskActionsDisabled: false, updatedAt: new Date().toISOString(),
  }
}
let fraudState = initialState()
function level(score: number) { return score >= 90 ? 'CRITICAL' : score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW' }
function refresh() { fraudState.updatedAt = new Date().toISOString(); return fraudState }
function addInboxMessage(kind: 'alert' | 'resolution', body: string) {
  fraudState.inbox.unshift({ id: id('MSG'), sender: 'FraudShield Security Team', body, time: stamp(), kind })
}

async function notifyCustomer() {
  const ussdCode = process.env.AT_USSD_SERVICE_CODE || '*123#'
  const message = 'FraudShield Security Team: We detected a suspicious KSh 75,000 transaction after a SIM change. The transfer is blocked. Was this you? Dial ' + ussdCode + ' and select 1 for NOT ME or 2 for YES, IT WAS ME.'
  if (!configured()) return { delivered: false, mode: 'sandbox' as const, message }
  try {
    const module = await import('africastalking')
    const client = module.default({ username: process.env.AT_USERNAME, apiKey: process.env.AT_API_KEY })
    await client.SMS.send({ to: [fraudState.customer.phone.replace(/\s/g, '')], message, senderId: process.env.AT_SENDER_ID })
    return { delivered: false, mode: 'connected' as const, message }
  } catch { return { delivered: false, mode: 'sandbox' as const, message } }
}

function applyCustomerDecision(decision: 'YES' | 'NO') {
  if (!fraudState.alert?.active || !fraudState.incident || fraudState.transaction.status !== 'BLOCKED') return { error: 'There is no blocked fraud alert awaiting confirmation.' as const }
  if (decision === 'YES') {
    fraudState.riskScore = 25; fraudState.securityStatus = 'NORMAL'; fraudState.highRiskActionsDisabled = false
    fraudState.suspiciousDevice = false; fraudState.suspiciousSim = false; fraudState.beneficiaryBlocked = false
    fraudState.transaction = { ...fraudState.transaction, status: 'RELEASED', risk: 25 }
    fraudState.incident = { ...fraudState.incident, customerDecision: 'YES', status: 'VERIFIED', resolvedAt: new Date().toISOString(), riskScore: 25, riskLevel: 'LOW' }
    fraudState.alert = { ...fraudState.alert, active: false }
    fraudState.events.push({ id: id('EV'), type: 'customer_decision', time: stamp(), title: 'Customer verified activity', detail: 'Additional verification completed; transaction released.', contribution: -69 })
    addInboxMessage('resolution', 'ACTIVITY VERIFIED\nYour transaction has been released.')
    return { state: refresh(), message: 'Activity verified. Your transaction has been released.' }
  }
  fraudState.riskScore = 94; fraudState.securityStatus = 'PROTECTED'; fraudState.highRiskActionsDisabled = true
  fraudState.suspiciousDevice = true; fraudState.suspiciousSim = true; fraudState.beneficiaryBlocked = true
  fraudState.incident = { ...fraudState.incident, customerDecision: 'NO', status: 'PROTECTED', riskScore: 94, riskLevel: 'CRITICAL' }
  fraudState.alert = { ...fraudState.alert, active: false }
  fraudState.events.push({ id: id('EV'), type: 'customer_decision', time: stamp(), title: 'Customer confirmed: this was not me', detail: 'Account remains protected; incident response completed automatically.', contribution: 0 })
  addInboxMessage('resolution', 'ACCOUNT PROTECTED\nTransaction and beneficiary remain blocked.\nReference: ' + (fraudState.incident?.id ?? 'FS-20260924-00421'))
  return { state: refresh(), message: 'Account protected. The suspicious transaction remains blocked.' }
}

const loginSchema = z.object({ email: z.string().email().max(160), password: z.string().min(1).max(128) })
app.post('/api/auth/login', limit, (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid demo email and password.' })
  const user = users.find((account) => account.email === parsed.data.email)
  if (!user || parsed.data.password !== 'Demo@123') return res.status(401).json({ error: 'Invalid demo credentials. Use password Demo@123.' })
  return res.json({ mode: 'demo', user })
})

app.get('/api/demo/state', (_req, res) => res.json(fraudState))
app.post('/api/demo/reset', (_req, res) => { fraudState = initialState(); return res.json(fraudState) })
app.post('/api/demo/transactions/normal', (_req, res) => {
  if (fraudState.securityStatus === 'PROTECTED') return res.status(423).json({ error: 'High-risk actions are temporarily protected. View your security alert for next steps.', state: fraudState })
  fraudState.transaction = { ...fraudState.transaction, id: id('TXN'), amount: 2500, recipient: 'Trusted merchant', time: stamp(), location: 'Nairobi', status: 'NORMAL', risk: fraudState.riskScore }
  return res.json(refresh())
})

const stepSchema = z.object({ type: z.enum(['sim_swap', 'new_device', 'new_location', 'password_reset', 'new_beneficiary', 'airtime_purchase', 'large_transfer']) })
app.post('/api/demo/attack/step', async (req, res) => {
  const parsed = stepSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Unknown attack event.' })
  const completed = fraudState.events.filter((event) => event.type in eventDefinitions).length
  const expected = attackOrder[completed]
  if (!expected) return res.status(409).json({ error: 'The full attack chain has already completed.', state: fraudState })
  if (parsed.data.type !== expected) return res.status(409).json({ error: 'Expected ' + expected.replace('_', ' ') + ' next.', state: fraudState })
  const definition = eventDefinitions[parsed.data.type]
  fraudState.riskScore = Math.min(94, fraudState.riskScore + definition.contribution)
  fraudState.events.push({ id: id('EV'), type: parsed.data.type, time: stamp(), ...definition })
  fraudState.transaction = { ...fraudState.transaction, time: stamp(), risk: fraudState.riskScore, status: parsed.data.type === 'large_transfer' ? 'BLOCKED' : fraudState.riskScore >= 70 ? 'FLAGGED' : 'PENDING' }
  if (fraudState.riskScore >= 70 && fraudState.securityStatus === 'NORMAL') fraudState.securityStatus = 'RESTRICTED'
  if (parsed.data.type === 'large_transfer') {
    fraudState.securityStatus = 'PROTECTED'
    fraudState.suspiciousDevice = true; fraudState.suspiciousSim = true; fraudState.beneficiaryBlocked = true; fraudState.highRiskActionsDisabled = true
    fraudState.incident = { id: 'FS-20260924-00421', customerId: fraudState.customer.id, riskScore: fraudState.riskScore, riskLevel: 'CRITICAL', triggerEvents: fraudState.events.map((event) => event.title), blockedActions: ['KSh 75,000 transfer', 'New beneficiary', 'PIN/password changes', 'Unusual airtime transfers'], customerDecision: null, status: 'OPEN', createdAt: new Date().toISOString(), resolvedAt: null }
    fraudState.alert = { active: true, ...(await notifyCustomer()) }
    addInboxMessage('alert', 'We blocked a suspicious KSh 75,000 transfer after a SIM change. Confirm through the USSD security menu: 1 for NOT ME, or 2 for IT WAS ME.')
    fraudState.events.push({ id: id('EV'), type: 'protection', time: stamp(), title: 'FraudShield protected the account', detail: 'Transfer and new beneficiary blocked; customer alert created.', contribution: 0 })
  }
  return res.json(refresh())
})

const decisionSchema = z.object({ decision: z.enum(['YES', 'NO']) })
app.post('/api/demo/customer-decision', (req, res) => {
  const parsed = decisionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Choose YES or NO to respond to the security alert.' })
  const result = applyCustomerDecision(parsed.data.decision)
  if ('error' in result) return res.status(409).json({ error: result.error, state: fraudState })
  return res.json(result.state)
})

const ussdSchema = z.object({ sessionId: z.string().max(120).optional(), serviceCode: z.string().max(60).optional(), networkCode: z.string().max(20).optional(), phoneNumber: z.string().min(8).max(30), text: z.string().max(40).default('') })
function normalizePhone(phoneNumber: string) {
  const digits = phoneNumber.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) return '254' + digits.slice(1)
  return digits
}
function ussdSecurityHandler(req: express.Request, res: express.Response) {
  const parsed = ussdSchema.safeParse(req.body)
  if (!parsed.success) return res.type('text/plain').send('END Unable to validate this USSD session. Please try again.')
  if (normalizePhone(parsed.data.phoneNumber) !== normalizePhone(fraudState.customer.phone)) return res.type('text/plain').send('END This phone number is not eligible for this account security session.')
  console.info('USSD security session received', { sessionId: parsed.data.sessionId, networkCode: parsed.data.networkCode, phoneNumber: parsed.data.phoneNumber })
  const input = parsed.data.text.trim()
  if (!fraudState.alert?.active) return res.type('text/plain').send('END No fraud alert is awaiting confirmation. Your account security status is ' + fraudState.securityStatus + '.')
  if (!input) return res.type('text/plain').send('CON FRAUDSHIELD SECURITY\nSuspicious KSh 75,000 transfer blocked.\n1. This was not me\n2. This was me')
  if (input === '1') {
    const result = applyCustomerDecision('NO')
    return res.type('text/plain').send('END ACCOUNT PROTECTED\nTransaction and beneficiary remain blocked.\nReference: ' + (fraudState.incident?.id ?? 'FS-20260924-00421'))
  }
  if (input === '2') {
    const result = applyCustomerDecision('YES')
    return res.type('text/plain').send('END ACTIVITY VERIFIED\nYour transaction has been released.')
  }
  return res.type('text/plain').send('CON Invalid option.\n1. This was not me\n2. This was me')
}
app.post('/api/ussd', ussdSecurityHandler)
app.post('/api/webhooks/africastalking/ussd', ussdSecurityHandler)
const ussdEventSchema = z.object({ sessionId: z.string().max(120).optional(), phoneNumber: z.string().max(30).optional(), networkCode: z.string().max(20).optional(), status: z.string().max(80).optional() }).passthrough()
app.post('/api/ussd/events', (req, res) => {
  const parsed = ussdEventSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid USSD event payload.' })
  console.info('Africa’s Talking USSD session event received', { sessionId: parsed.data.sessionId, phoneNumber: parsed.data.phoneNumber, networkCode: parsed.data.networkCode, status: parsed.data.status })
  return res.status(200).send('OK')
})

const notificationSchema = z.object({ customerRef: z.string().max(80), to: z.string().regex(/^\+[1-9]\d{7,14}$/), template: z.enum(['sim_swap', 'account_protection', 'customer_report']), investigationRef: z.string().max(80) })
const templates = { sim_swap: 'FraudShield Alert: A SIM replacement was requested. If this was not you, secure your account immediately.', account_protection: 'FraudShield Alert: Risky activity is temporarily protected while we verify your account.', customer_report: 'FraudShield: We received your report and protected risky activity.' }
app.get('/api/health', (_req, res) => res.json({ africaTalking: configured(), voice: Boolean(configured() && process.env.AT_VOICE_NUMBER), llm: Boolean(process.env.OPENAI_API_KEY) }))
app.post('/api/notifications/sms', limit, async (req, res) => {
  const parsed = notificationSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid notification request.' })
  if (!configured()) return res.json({ mode: 'simulated', status: 'queued', message: 'Africa’s Talking Sandbox is not configured; alert recorded safely in demo mode.' })
  try {
    const module = await import('africastalking'); const client = module.default({ username: process.env.AT_USERNAME, apiKey: process.env.AT_API_KEY })
    const provider = await client.SMS.send({ to: [parsed.data.to], message: templates[parsed.data.template], senderId: process.env.AT_SENDER_ID })
    return res.json({ mode: 'live', status: 'sent', provider })
  } catch { return res.json({ mode: 'simulated', status: 'queued', message: 'Provider unavailable; alert recorded as a demo delivery.' }) }
})

const scamSchema = z.object({ message: z.string().trim().min(3).max(640) })
app.post('/api/scam/analyze', limit, (req, res) => {
  const parsed = scamSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Paste a message between 3 and 640 characters.' })
  const value = parsed.data.message.toLowerCase(); const indicators = [value.match(/https?:\/\/|www\.|\.co\.ke|\.com/) && 'Suspicious URL', value.match(/urgent|immediately|today|suspend/) && 'Urgency language', value.match(/mpesa|m-pesa|bank|safaricom/) && 'Brand impersonation', value.match(/verify|password|pin|credential|login/) && 'Credential request'].filter(Boolean)
  const score = Math.min(98, 30 + indicators.length * 16 + (value.includes('http') ? 4 : 0))
  return res.json({ mode: 'deterministic', score, classification: score >= 75 ? 'Potential phishing' : 'Requires review', indicators: indicators.length ? indicators : ['Unusual sender language'] })
})

const analystSchema = z.object({ question: z.string().max(600), evidence: z.array(z.string().max(180)).max(12), score: z.number().min(0).max(100) })
app.post('/api/analyst/query', limit, (req, res) => {
  const parsed = analystSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid analyst request.' })
  return res.json({ mode: 'deterministic', answer: 'This is elevated risk, not a final fraud determination. Score ' + parsed.data.score + '/100 is driven by: ' + parsed.data.evidence.slice(0, 4).join('; ') + '. FraudShield has applied temporary protection and is waiting for the customer’s confirmation.' })
})

const webhookEventSchema = z.object({ event: z.string().max(120).optional(), status: z.string().max(80).optional() }).passthrough()
for (const channel of ['sms', 'voice', 'airtime', 'payments']) app.post('/api/webhooks/africastalking/' + channel, (req, res) => {
  const parsed = webhookEventSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid webhook payload.' })
  console.info('Africa’s Talking ' + channel + ' webhook received', { event: parsed.data.event, status: parsed.data.status })
  return res.status(202).json({ accepted: true, channel, mode: configured() ? 'configured' : 'sandbox' })
})
if (process.env.NODE_ENV !== 'test') app.listen(8787, () => console.log('FraudShield API ready on http://localhost:8787'))
