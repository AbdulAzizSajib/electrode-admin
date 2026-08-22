import { generateId } from '@/lib/api/client'
import type { Address } from '@/lib/api/shared-types'

export type UserRole = 'OWNER' | 'ADMIN' | 'STAFF' | 'CUSTOMER'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  isActive: boolean
  createdAt: string
  addresses: Address[]
}

function addr(fullName: string, city: string, state: string): Address {
  return { fullName, line1: `${100 + Math.floor(Math.random() * 800)} Market St`, city, state, postalCode: '90001', country: 'USA', phone: '+1 555-010-0100' }
}

let users: User[] = [
  { id: generateId('usr'), name: 'Evelyn Carter', email: 'evelyn.carter@example.com', role: 'OWNER', isActive: true, createdAt: '2025-01-10T09:00:00Z', addresses: [] },
  { id: generateId('usr'), name: 'Marcus Webb', email: 'marcus.webb@example.com', role: 'ADMIN', isActive: true, createdAt: '2025-02-14T09:00:00Z', addresses: [] },
  { id: generateId('usr'), name: 'Priya Nair', email: 'priya.nair@example.com', role: 'STAFF', isActive: true, createdAt: '2025-03-02T09:00:00Z', addresses: [] },
  { id: generateId('usr'), name: 'Diego Alvarez', email: 'diego.alvarez@example.com', role: 'STAFF', isActive: false, createdAt: '2025-04-19T09:00:00Z', addresses: [] },

  { id: generateId('usr'), name: 'Sofia Reyes', email: 'sofia.reyes@example.com', role: 'CUSTOMER', isActive: true, createdAt: '2025-05-03T09:00:00Z', addresses: [addr('Sofia Reyes', 'Austin', 'TX')] },
  { id: generateId('usr'), name: 'Liam Chen', email: 'liam.chen@example.com', role: 'CUSTOMER', isActive: true, createdAt: '2025-05-20T09:00:00Z', addresses: [addr('Liam Chen', 'Seattle', 'WA')] },
  { id: generateId('usr'), name: 'Amara Okafor', email: 'amara.okafor@example.com', role: 'CUSTOMER', isActive: true, createdAt: '2025-06-11T09:00:00Z', addresses: [addr('Amara Okafor', 'Atlanta', 'GA')] },
  { id: generateId('usr'), name: 'Noah Kim', email: 'noah.kim@example.com', role: 'CUSTOMER', isActive: true, createdAt: '2025-07-08T09:00:00Z', addresses: [addr('Noah Kim', 'Denver', 'CO')] },
  { id: generateId('usr'), name: 'Isabella Rossi', email: 'isabella.rossi@example.com', role: 'CUSTOMER', isActive: true, createdAt: '2025-08-17T09:00:00Z', addresses: [addr('Isabella Rossi', 'Miami', 'FL'), addr('Isabella Rossi', 'Orlando', 'FL')] },
  { id: generateId('usr'), name: 'Ethan Brooks', email: 'ethan.brooks@example.com', role: 'CUSTOMER', isActive: true, createdAt: '2025-09-25T09:00:00Z', addresses: [addr('Ethan Brooks', 'Boston', 'MA')] },
  { id: generateId('usr'), name: 'Hana Kobayashi', email: 'hana.kobayashi@example.com', role: 'CUSTOMER', isActive: true, createdAt: '2025-10-30T09:00:00Z', addresses: [addr('Hana Kobayashi', 'Portland', 'OR')] },
  { id: generateId('usr'), name: 'Lucas Martin', email: 'lucas.martin@example.com', role: 'CUSTOMER', isActive: false, createdAt: '2025-11-12T09:00:00Z', addresses: [addr('Lucas Martin', 'Phoenix', 'AZ')] },
]

export function _getAllUsers() {
  return users
}

export function _getUserById(id: string) {
  return users.find((u) => u.id === id)
}

export function _setUsers(next: User[]) {
  users = next
}
