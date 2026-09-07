/**
 * Shop-wide product attributes — Colour, Size, Weight — and their ordered
 * values. Defined once and selected on any number of products; see
 * `admin/product-attributes`.
 *
 * Same envelope/error conventions as `src/lib/api/brands.ts`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ListParams, type PaginatedResponse } from '@/lib/api/client'
import { request } from '@/lib/api/request'
import { queryKeys } from '@/lib/api/query-keys'
import { buildListQuery } from '@/lib/api/list-query'

export type AttributePresentation = 'SWATCH' | 'LABEL'

export interface AttributeValue {
  id: string
  attributeId: string
  label: string
  position: number
  swatch: string | null
}

export interface Attribute {
  id: string
  name: string
  position: number
  presentation: AttributePresentation
  values: AttributeValue[]
  createdAt: string
  updatedAt: string
}

/** A value on the way in. `id` targets an existing row; omitted creates one. */
export interface AttributeValueInput {
  id?: string
  label: string
  swatch?: string
}

export interface AttributeInput {
  name: string
  presentation?: AttributePresentation
  /** Position is taken from array order, so two values cannot claim the same one. */
  values: AttributeValueInput[]
}

async function listAttributes(params: ListParams = {}): Promise<PaginatedResponse<Attribute>> {
  const { query, limit } = buildListQuery(params)
  const res = await request<Attribute[]>(`/attributes?${query}`)
  return {
    data: res.data,
    meta: res.meta ?? { page: params.page ?? 1, limit, total: res.data.length, totalPages: 1 },
  }
}

/** Every attribute with its values, for the product form's pickers. Unpaginated. */
async function listAllAttributes(): Promise<Attribute[]> {
  const res = await request<Attribute[]>('/attributes/all')
  return res.data
}

async function getAttribute(id: string): Promise<Attribute> {
  const res = await request<Attribute>(`/attributes/${id}`)
  return res.data
}

async function createAttribute(input: AttributeInput): Promise<Attribute> {
  const res = await request<Attribute>('/attributes', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

/**
 * `force` confirms an edit that removes values products still sell. Without it
 * the backend refuses with a 409 naming the count — which is what drives the
 * shared list page's confirm-then-retry flow.
 */
async function updateAttribute(
  id: string,
  input: Partial<AttributeInput>,
  force?: boolean,
): Promise<Attribute> {
  const res = await request<Attribute>(`/attributes/${id}${force ? '?force=1' : ''}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return res.data
}

async function deleteAttribute(id: string, force?: boolean): Promise<void> {
  await request<unknown>(`/attributes/${id}${force ? '?force=1' : ''}`, { method: 'DELETE' })
}

/*
 * One value at a time.
 *
 * `updateAttribute` sends the whole `values` array and the backend deletes what
 * it omits — right for the Attributes page, which authors that list, and unsafe
 * anywhere else: a caller that rebuilds the array from a list fetched a minute
 * ago drops any value added since. These three name the value in the path and
 * touch nothing else, which is what lets the product form edit an attribute it
 * does not own.
 */

async function createAttributeValue(
  attributeId: string,
  input: { label: string; swatch?: string },
): Promise<AttributeValue> {
  const res = await request<AttributeValue>(`/attributes/${attributeId}/values`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res.data
}

async function updateAttributeValue(
  attributeId: string,
  valueId: string,
  input: { label?: string; swatch?: string | null },
): Promise<AttributeValue> {
  const res = await request<AttributeValue>(`/attributes/${attributeId}/values/${valueId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return res.data
}

/** `force` confirms removing a value products still sell; without it, a 409. */
async function deleteAttributeValue(
  attributeId: string,
  valueId: string,
  force?: boolean,
): Promise<void> {
  await request<unknown>(
    `/attributes/${attributeId}/values/${valueId}${force ? '?force=1' : ''}`,
    { method: 'DELETE' },
  )
}

export function useAttributes(params: ListParams = {}) {
  return useQuery({
    queryKey: queryKeys.attributes.list(params),
    queryFn: () => listAttributes(params),
  })
}

export function useAllAttributes() {
  return useQuery({ queryKey: queryKeys.attributes.all, queryFn: listAllAttributes })
}

export function useAttribute(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.attributes.detail(id ?? ''),
    queryFn: () => getAttribute(id as string),
    enabled: !!id,
  })
}

export function useCreateAttribute() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: createAttribute,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.attributes.all }),
  })
}

export function useUpdateAttribute() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
      force,
    }: {
      id: string
      input: Partial<AttributeInput>
      force?: boolean
    }) => updateAttribute(id, input, force),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.attributes.all }),
  })
}

export function useDeleteAttribute() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => deleteAttribute(id, force),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.attributes.all }),
  })
}

export function useCreateAttributeValue() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      attributeId,
      input,
    }: {
      attributeId: string
      input: { label: string; swatch?: string }
    }) => createAttributeValue(attributeId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.attributes.all }),
  })
}

export function useUpdateAttributeValue() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      attributeId,
      valueId,
      input,
    }: {
      attributeId: string
      valueId: string
      input: { label?: string; swatch?: string | null }
    }) => updateAttributeValue(attributeId, valueId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.attributes.all }),
  })
}

export function useDeleteAttributeValue() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      attributeId,
      valueId,
      force,
    }: {
      attributeId: string
      valueId: string
      force?: boolean
    }) => deleteAttributeValue(attributeId, valueId, force),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.attributes.all }),
  })
}
