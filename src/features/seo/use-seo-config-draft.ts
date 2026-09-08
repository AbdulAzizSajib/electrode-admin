import {
  DEFAULT_SEO_CONFIG,
  useStoreSettings,
  useUpdateStoreSettings,
  type SeoConfig,
} from '@/lib/api/store-settings'
import {
  useSettingsDraft,
  useUnsavedChangesGuard,
} from '@/features/ui/components/settings-editor-utils'

/**
 * The shared spine of the four SEO settings screens.
 *
 * All four edit facets of ONE stored object, and `PATCH /settings` does not
 * merge inside `seoConfig` — a present value replaces the whole blob. So each
 * screen must send the complete config it loaded with only its own section
 * changed. Doing that by hand in four places is one forgotten spread away from a
 * screen silently blanking the other three, which is why it lives here instead:
 * a screen calls `save(next)` with the whole config and cannot express the
 * broken version.
 *
 * Everything else is the settings-editor pattern the UI screens already use —
 * the draft holds only the override, so a background refetch cannot overwrite
 * someone mid-edit, and `reset` is just dropping it.
 */
export function useSeoConfigDraft() {
  const { data, isLoading, error } = useStoreSettings()
  const updateMutation = useUpdateStoreSettings()

  /*
   * `data &&` matters: until the settings row arrives the draft has no loaded
   * value, and `useSettingsDraft` treats that as not-yet-dirty rather than as a
   * merchant's choice. Seeding from DEFAULT_SEO_CONFIG rather than from nulls so
   * an unconfigured store shows what the storefront is actually doing — for an
   * `index` flag, defaulting the UI to off would read as a page withdrawn from
   * search that nobody withdrew.
   */
  const draft = useSettingsDraft<SeoConfig>(
    data && (data.seoConfig ?? DEFAULT_SEO_CONFIG),
    DEFAULT_SEO_CONFIG,
  )
  const blocker = useUnsavedChangesGuard(draft.isDirty)

  const config = draft.value

  /** Applies a patch to the top level and keeps the rest of the config intact. */
  const setConfig = (patch: Partial<SeoConfig>) => draft.set({ ...config, ...patch })

  /**
   * Sends the WHOLE config. The only save path these screens have — see the note
   * at the top of this file for why there is no partial variant.
   */
  const save = async (next: SeoConfig = config) => {
    await updateMutation.mutateAsync({ seoConfig: next })
    draft.markSaved(next)
  }

  return {
    config,
    setConfig,
    save,
    isDirty: draft.isDirty,
    reset: draft.reset,
    isSaving: updateMutation.isPending,
    isLoading,
    error,
    blocker,
  }
}
