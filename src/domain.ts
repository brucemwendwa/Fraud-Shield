export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type Role = 'customer' | 'admin'
export type SecurityStatus = 'NORMAL' | 'MONITORING' | 'RESTRICTED' | 'PROTECTED'
export type TransactionStatus = 'NORMAL' | 'PENDING' | 'FLAGGED' | 'BLOCKED' | 'VERIFIED' | 'RELEASED' | 'PROTECTED'
export type CustomerDecision = 'YES' | 'NO' | null
export type AttackEventType = 'sim_swap' | 'new_device' | 'new_location' | 'password_reset' | 'new_beneficiary' | 'airtime_purchase' | 'large_transfer'

export interface User { id: string; name: string; initials: string; role: Role; email: string; permissions: string[] }
export interface FraudEvent { id: string; type: AttackEventType | 'protection' | 'customer_decision'; time: string; title: string; detail: string; contribution: number }
export interface FraudTransaction { id: string; amount: number; recipient: string; time: string; location: string; status: TransactionStatus; risk: number }
export interface FraudIncident { id: string; customerId: string; riskScore: number; riskLevel: Severity; triggerEvents: string[]; blockedActions: string[]; customerDecision: CustomerDecision; status: 'OPEN' | 'VERIFIED' | 'PROTECTED'; createdAt: string; resolvedAt: string | null }
export interface CustomerInboxMessage { id: string; sender: string; body: string; time: string; kind: 'alert' | 'resolution' }
export interface FraudDemoState { customer: { id: string; name: string; phone: string; account: string; balance: number; device: string; location: string }; securityStatus: SecurityStatus; riskScore: number; transaction: FraudTransaction; events: FraudEvent[]; alert: { active: boolean; delivered: boolean; mode: 'sandbox' | 'connected'; message: string } | null; inbox: CustomerInboxMessage[]; incident: FraudIncident | null; suspiciousDevice: boolean; suspiciousSim: boolean; beneficiaryBlocked: boolean; highRiskActionsDisabled: boolean; updatedAt: string }

export const severityForScore = (score: number): Severity => score >= 90 ? 'CRITICAL' : score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW'
export const securityTone = (status: SecurityStatus) => ({ NORMAL: 'safe', MONITORING: 'medium', RESTRICTED: 'high', PROTECTED: 'critical' })[status]
export const roleLabel = (role: Role) => role === 'admin' ? 'Security Admin' : 'Customer'
// Retained for the existing focused risk-classification test.
export const stageForEvents = (count: number) => ['Early signal', 'Credential compromise', 'Social engineering', 'SIM swap', 'Account takeover', 'Asset movement', 'Mule detection'][Math.min(6, Math.floor(Math.max(0, count) / 2))]
