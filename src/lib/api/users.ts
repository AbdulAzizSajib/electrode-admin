/**
 * Shared user types for the real backend.
 *
 * This module used to hold the in-memory mock store (`_getAllUsers`, `_setUsers`, `_getUserById`)
 * that `customers.ts`, `roles.ts`, `staff-users.ts`, and `support-tickets.ts` all read from at
 * import time. That store is gone; the types below are what those modules share now, and the
 * requests themselves live in `staff-users.ts`.
 */

/**
 * Role names `checkAuth` gates on. The backend compares `Role.name` against these fixed strings,
 * so they are the roles that actually change what a session may do — distinct from the arbitrary
 * `Role` records the roles page can create.
 */
export const ROLE_NAMES = ['OWNER', 'ADMIN', 'STAFF', 'CUSTOMER'] as const
export type UserRole = (typeof ROLE_NAMES)[number]

export const USER_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

/** The role summary embedded in user responses. */
export interface UserRoleRef {
  id: string
  name: string
}

export interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  roleId: string
  role: UserRoleRef
  status: UserStatus
  contactNumber: string | null
  image: string | null
  isActive: boolean
  /** Null when the user has never signed in — not an epoch date. */
  lastLoginAt: string | null
  needPasswordChange: boolean
  createdAt: string
  updatedAt: string
}
