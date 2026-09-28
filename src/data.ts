import type { AttackEventType, User } from './domain'

export const demoUsers: User[] = [
  { id: 'cus-001245', name: 'Brian Otieno', initials: 'BO', role: 'customer', email: 'brian.otieno@fraudshield.demo', permissions: ['customer-dashboard', 'fraud-dna'] },
  { id: 'adm-001', name: 'Grace Wanjiku', initials: 'GW', role: 'admin', email: 'grace.admin@fraudshield.demo', permissions: ['admin-dashboard', 'threats', 'simulator', 'fraud-dna', 'integrations'] },
]

export const attackSteps: Array<{ type: AttackEventType; label: string; detail: string }> = [
  { type: 'sim_swap', label: 'SIM swap detected', detail: 'A replacement SIM was activated for +254 712 345 678.' },
  { type: 'new_device', label: 'New device detected', detail: 'An untrusted Android device accessed the account.' },
  { type: 'new_location', label: 'New location detected', detail: 'Activity moved outside Brian’s recent Nairobi pattern.' },
  { type: 'password_reset', label: 'Password reset detected', detail: 'A sensitive account action followed the SIM change.' },
  { type: 'new_beneficiary', label: 'New beneficiary created', detail: 'A new recipient was added during the high-risk session.' },
  { type: 'airtime_purchase', label: 'Suspicious airtime purchase', detail: 'An unusual airtime purchase exceeded the normal pattern.' },
  { type: 'large_transfer', label: 'KSh 75,000 transfer attempted', detail: 'FraudShield blocked the transfer and alerted the customer.' },
]
