import { useNavigate } from 'react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { Type } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ResourceListPage } from '@/components/crud/resource-list-page'
import { useDeleteFont, useAllFonts, useFonts, type Font } from '@/lib/api/fonts'
import {
  DEFAULT_THEME,
  useStoreSettings,
  useUpdateStoreSettings,
  type Theme,
} from '@/lib/api/store-settings'
import { FontStylesheets } from '@/features/ui/fonts/font-stylesheets'

export const FONTS_PATH = '/ui/fonts'

/**
 * The font library.
 *
 * Two things here are not the usual list-page boilerplate:
 *
 *  1. **Every row previews itself.** A font list that renders every name in the
 *     admin's own typeface tells a merchant nothing — the whole point of the
 *     screen is choosing how something looks. `FontStylesheets` loads each
 *     library font so the cells can be set in the face they name.
 *
 *  2. **Delete escalates to reassignment.** The server refuses (409) to delete
 *     a font the storefront or admin panel is using. The client never
 *     pre-checks that — it asks, gets refused, and `ResourceListPage` opens the
 *     replacement picker. The retry then does the two calls the design
 *     specifies: PATCH the settings onto the replacement, then delete.
 *
 * See openspec/changes/add-font-library-and-admin-font, design.md Decision 5.
 */
export default function FontsListPage() {
  const navigate = useNavigate()
  const deleteMutation = useDeleteFont()
  const updateSettings = useUpdateStoreSettings()
  const { data: allFonts } = useAllFonts()
  const { data: settings } = useStoreSettings()

  const theme: Theme = settings?.theme ?? DEFAULT_THEME
  const storefrontFamily = theme.font?.family
  const adminFamily = theme.adminFont?.family ?? DEFAULT_THEME.adminFont?.family

  const columns: ColumnDef<Font>[] = [
    {
      accessorKey: 'family',
      header: 'Font',
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">{row.original.family}</span>
          {/*
           * The preview. Quoted family plus a fallback stack, so a stylesheet
           * that has not loaded yet degrades to readable text rather than to
           * nothing.
           */}
          <span
            className="text-lg leading-snug text-muted-foreground"
            style={{ fontFamily: `"${row.original.family}", system-ui, sans-serif` }}
          >
            Aa Bb Cc — 0123
          </span>
        </div>
      ),
    },
    {
      id: 'inUse',
      header: 'In use',
      cell: ({ row }) => {
        const onStorefront = row.original.family === storefrontFamily
        const onAdmin = row.original.family === adminFamily

        if (!onStorefront && !onAdmin) {
          return <span className="text-xs text-muted-foreground">—</span>
        }

        return (
          <div className="flex flex-wrap gap-1">
            {onStorefront && <Badge variant="success">Storefront</Badge>}
            {onAdmin && <Badge variant="secondary">Admin panel</Badge>}
          </div>
        )
      },
    },
  ]

  return (
    <>
      {/*
       * Loads a stylesheet per library font so the previews above render in the
       * face they name. Mounted with the list and torn down with it.
       */}
      <FontStylesheets fonts={allFonts ?? []} />

      <ResourceListPage
        title="Fonts"
        description="The typefaces available to the storefront and the admin panel. Add a font once and it stays here to select."
        noun="font"
        icon={Type}
        emptyTitle="No fonts yet"
        emptyDescription="Add a font by pasting what Google Fonts gives you — the @import rule, the <link> tag, or just the URL."
        searchPlaceholder="Search by font name…"
        columns={columns}
        useList={useFonts}
        getRowId={(row) => row.id}
        getRowLabel={(row) => row.family}
        onCreate={() => navigate(`${FONTS_PATH}/new`)}
        createLabel="Add font"
        onEdit={(row) => navigate(`${FONTS_PATH}/${row.id}`)}
        remove={{
          mode: 'reassign',
          /*
           * Two calls, not one. The first attempt carries no reassignment and
           * is refused by the server if the font is selected anywhere. The
           * retry arrives with the replacement's id: point every surface using
           * this font at the replacement, then delete.
           *
           * Deliberately not a bespoke transactional endpoint — each call is
           * ordinary and neither is itself partial. The worst interruption
           * leaves the surfaces reassigned and the old font still listed, which
           * is visible and harmless.
           */
          remove: async ({ id, reassignToId }) => {
            if (reassignToId) {
              const target = (allFonts ?? []).find((f) => f.id === reassignToId)
              const doomed = (allFonts ?? []).find((f) => f.id === id)

              if (target && doomed) {
                const usedOnStorefront = theme.font?.family === doomed.family
                const usedOnAdmin =
                  (theme.adminFont?.family ?? DEFAULT_THEME.adminFont?.family) === doomed.family

                if (usedOnStorefront || usedOnAdmin) {
                  await updateSettings.mutateAsync({
                    theme: {
                      ...theme,
                      font: {
                        family: usedOnStorefront ? target.family : theme.font.family,
                      },
                      adminFont: {
                        family: usedOnAdmin
                          ? target.family
                          : (theme.adminFont?.family ?? DEFAULT_THEME.adminFont!.family),
                      },
                    },
                  })
                }
              }
            }

            return deleteMutation.mutateAsync(id)
          },
          /* Any other font in the library is a valid replacement. */
          reassignOptions: (row) =>
            (allFonts ?? [])
              .filter((f) => f.id !== row.id)
              .map((f) => ({ value: f.id, label: f.family })),
          reassignLabel: 'Use this font instead',
          confirmDescription:
            'The font is removed from the library. Anywhere it is selected must be pointed at another font first.',
        }}
      />
    </>
  )
}
