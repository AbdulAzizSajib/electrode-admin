/**
 * Third-party connections — the admin side of
 * `rename-courier-setting-to-integrations`.
 *
 * WHAT THIS MODULE CANNOT DO IS THE POINT: there is no function here that reads
 * a stored credential, because the server has no endpoint that returns one. The
 * types below have no field a secret could arrive in. If a "reveal" feature is
 * ever asked for, it has to change the server, this file, and the reasoning in
 * both — which is the friction intended, because a value the API can return is
 * a value an XSS or a screenshotted devtools panel can capture.
 *
 * What the panel gets instead is whether each credential is PRESENT, plus a
 * four-character hint — enough for a merchant to tell this year's key from last
 * year's, useless to anyone else.
 *
 * The credential FORM is generated from `credentials` below rather than
 * hardcoded per integration. That is what makes adding the next one a server
 * change alone: a courier needing four fields instead of two renders correctly
 * here without this file learning its name. See design.md Decision 4.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestData } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'

/** Where a card belongs on the page. */
export type IntegrationCategory = 'COURIER' | 'MARKETING' | 'NOTIFICATION'

/** One credential's declaration and state, as the server reports it. */
export interface IntegrationCredentialState {
  /** Storage key. Also the form field name, so the two cannot drift. */
  kind: string
  label: string
  /** Drives the masked input AND the write-only treatment, together. */
  secret: boolean
  placeholder?: string
  present: boolean
  /**
   * `••••1234` for a stored secret, the actual value for a non-secret, null when
   * nothing is stored. Never enough to reconstruct a credential.
   */
  hint: string | null
}

export interface IntegrationState {
  id: string
  displayName: string
  description: string
  category: IntegrationCategory
  /** Whether the merchant has switched it on, independent of configuration. */
  enabled: boolean
  /** Every declared credential is present. True by definition when none are declared. */
  configured: boolean
  /**
   * False when a stored credential cannot be decrypted.
   *
   * Distinct from `configured` because the fixes differ: unconfigured is fixed
   * by typing the credentials in, unreadable is fixed by restoring the server's
   * encryption key — and typing them in again under the wrong key would just
   * produce more unreadable rows.
   */
  readable: boolean
  credentials: IntegrationCredentialState[]
  webhook?: {
    label: string
    instructions: string[]
    configured: boolean
    /** Null until a secret has been generated, which is what mints the URL. */
    callbackUrl: string | null
  }
}

/** The response to generating a webhook secret — the one time a secret is returned. */
export interface GeneratedWebhookSecret {
  secret: string
  callbackUrl: string
}

const listIntegrations = () => requestData<IntegrationState[]>('/integrations')

const getIntegration = (provider: string) =>
  requestData<IntegrationState>(`/integrations/${provider}`)

/**
 * Saves credentials.
 *
 * Sends only the fields the merchant actually filled in. The server leaves an
 * omitted kind untouched and ignores a blank one, which is what lets the form
 * submit without resending secrets it does not have — it cannot read them back,
 * so resending would be impossible anyway.
 */
const updateCredentials = (provider: string, values: Record<string, string>) =>
  requestData<IntegrationState>(`/integrations/${provider}/credentials`, {
    method: 'PUT',
    body: JSON.stringify({ values }),
  })

const generateWebhookSecret = (provider: string) =>
  requestData<GeneratedWebhookSecret>(`/integrations/${provider}/webhook`, {
    method: 'PUT',
    body: JSON.stringify({}),
  })

const setIntegrationEnabled = (provider: string, enabled: boolean) =>
  requestData<IntegrationState>(`/integrations/${provider}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  })

/**
 * Sends a test message through an integration and reports whether it worked.
 *
 * The ONE call in this module whose failure the merchant is meant to read. Every
 * other integration failure happens on the server, out of sight, because an
 * alert must never fail the order it announces — which is exactly why this
 * exists: without it, a mistyped Telegram chat ID is indistinguishable from a
 * quiet day, until an order is missed.
 *
 * No body. `requestData` throws `ApiError` carrying the backend's own message,
 * which here is Telegram's own wording — "chat not found" tells a merchant what
 * to fix in a way that "the test failed" never will.
 */
const testIntegration = (provider: string) =>
  requestData<{ message: string }>(`/integrations/${provider}/test`, {
    method: 'POST',
  })

export function useIntegrations() {
  return useQuery({
    queryKey: queryKeys.integrations.list,
    queryFn: listIntegrations,
    /*
     * Never cached across a save. Every mutation below invalidates this, and a
     * stale `present: false` after a successful save reads as the save having
     * been ignored — which is the one thing a credential form must never look
     * like, since the merchant cannot verify it by reading the value back.
     */
    staleTime: 0,
  })
}

export function useIntegration(provider: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.integrations.detail(provider),
    queryFn: () => getIntegration(provider),
    enabled,
    staleTime: 0,
  })
}

/**
 * Invalidates everything a credential change can affect.
 *
 * `courier.config` as well as the integration keys: that endpoint reports
 * whether the selected courier is ready to dispatch, and it derives that from
 * exactly these credentials. Leaving it stale would show "not configured" on the
 * courier card immediately after the merchant configured it.
 */
const invalidateIntegration = (
  client: ReturnType<typeof useQueryClient>,
  provider: string,
) => {
  client.invalidateQueries({ queryKey: queryKeys.integrations.all })
  client.invalidateQueries({ queryKey: queryKeys.integrations.detail(provider) })
  client.invalidateQueries({ queryKey: queryKeys.courier.config })
}

export function useUpdateIntegrationCredentials() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ provider, values }: { provider: string; values: Record<string, string> }) =>
      updateCredentials(provider, values),
    onSuccess: (_data, variables) => invalidateIntegration(client, variables.provider),
  })
}

export function useGenerateWebhookSecret() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: (provider: string) => generateWebhookSecret(provider),
    onSuccess: (_data, provider) => invalidateIntegration(client, provider),
  })
}

export function useSetIntegrationEnabled() {
  const client = useQueryClient()

  return useMutation({
    mutationFn: ({ provider, enabled }: { provider: string; enabled: boolean }) =>
      setIntegrationEnabled(provider, enabled),
    onSuccess: (_data, variables) => invalidateIntegration(client, variables.provider),
  })
}

/**
 * A test send.
 *
 * Deliberately does NOT invalidate anything on success: nothing about the
 * integration's stored state changed, and a refetch would only make a
 * successful test look like a save.
 */
export function useTestIntegration() {
  return useMutation({
    mutationFn: (provider: string) => testIntegration(provider),
  })
}

/** Integration ids this panel refers to by name. Mirrors the server's registry. */
export const INTEGRATION_IDS = {
  STEADFAST: 'STEADFAST',
  MANUAL: 'MANUAL',
  FACEBOOK_PIXEL: 'FACEBOOK_PIXEL',
  FACEBOOK_CAPI: 'FACEBOOK_CAPI',
  TELEGRAM: 'TELEGRAM',
} as const
