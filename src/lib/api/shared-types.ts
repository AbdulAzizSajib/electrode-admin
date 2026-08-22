/** Types shared across multiple mock API modules to avoid import cycles. */

export interface Address {
  fullName: string
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
  country: string
  phone?: string
}

export interface CustomerRef {
  id: string
  name: string
  email: string
}
