/**
 * The font library — the catalogue both font pickers select from.
 *
 * Follows the same envelope/error pattern as `testimonials.ts`. One thing is
 * specific to this resource: a font is written by PASTING an embed, and the
 * server derives `family` and `url` from it. There is deliberately no way to
 * send either directly — the parser that rebuilds the stylesheet URL from
 * validated parts is the only thing standing between a merchant's paste and a
 * `<link>` on every page of the shop, and a client-side field would route
 * around it.
 *
 * See openspec/changes/add-font-library-and-admin-font.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { buildListQuery } from '@/lib/api/list-query'
import { queryKeys } from '@/lib/api/query-keys'
import { request, requestData } from '@/lib/api/request'

export interface Font {
  id: string
  /** Human-readable, with spaces — "Open Sans", never "Open+Sans". */
  family: string
  /**
   * A `fonts.googleapis.com` stylesheet URL the backend rebuilt from validated
   * parts, with `display=swap` forced. Safe to put straight into a `<link>`;
   * never merchant text.
   */
  url: string
  createdAt: string
  updatedAt: string
}

/**
 * Both create and update take only the pasted embed — the `@import` rule, the
 * `<link>` tag, or the bare URL. Editing means re-pasting: `family` and `url`
 * both come out of one parse, so there is no subset of a font to patch.
 */
export interface FontInput {
  embed: string
}

async function listFonts(params: ListParams = {}): Promise<PaginatedResponse<Font>> {
  const { query, limit } = buildListQuery(params)

  const res = await request<Font[]>(`/fonts?${query}`)

  return {
    data: res.data,
    meta: res.meta ?? {
      page: params.page ?? 1,
      limit,
      total: res.data.length,
      totalPages: 1,
    },
  }
}

/** Every font, unpaginated — what the pickers render. */
async function listAllFonts(): Promise<Font[]> {
  return requestData<Font[]>('/fonts/all')
}

async function getFont(id: string): Promise<Font> {
  return requestData<Font>(`/fonts/${id}`)
}

async function createFont(input: FontInput): Promise<Font> {
  return requestData<Font>('/fonts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

async function updateFont(id: string, input: FontInput): Promise<Font> {
  return requestData<Font>(`/fonts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/**
 * Throws on 409 when the font is the storefront's or the admin panel's current
 * selection, with a message naming which. The caller is expected to escalate to
 * a reassign dialog rather than pre-checking — the client never decides whether
 * something is in use.
 */
async function deleteFont(id: string): Promise<void> {
  await request<Font>(`/fonts/${id}`, { method: 'DELETE' })
}

export function useFonts(params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.fonts.list(params),
    queryFn: () => listFonts(params),
  })
}

/**
 * Every font in the library.
 *
 * Kept fresh for a while by default: the pickers and the library list are on
 * different screens, and a font added on one should be selectable on the other
 * without a reload.
 */
export function useAllFonts() {
  return useQuery({
    queryKey: queryKeys.fonts.every(),
    queryFn: listAllFonts,
  })
}

export function useFont(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.fonts.detail(id ?? ''),
    queryFn: () => getFont(id!),
    enabled: !!id,
  })
}

export function useCreateFont() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createFont,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.fonts.all }),
  })
}

/**
 * Editing a font can change what the storefront or admin panel renders in —
 * the backend propagates a new URL to any surface selected on it — so the
 * settings query is invalidated alongside the library.
 */
export function useUpdateFont() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FontInput }) => updateFont(id, input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.fonts.all })
      client.invalidateQueries({ queryKey: queryKeys.storeSettings.detail })
    },
  })
}

export function useDeleteFont() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: deleteFont,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.fonts.all }),
  })
}
