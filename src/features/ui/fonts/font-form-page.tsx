import { useParams } from 'react-router'
import { Form, Input } from 'antd'
import { ResourceFormPage } from '@/components/crud/resource-form-page'
import { FONTS_PATH } from '@/features/ui/fonts/fonts-list-page'
import { useCreateFont, useFont, useUpdateFont, type Font } from '@/lib/api/fonts'

interface FormValues {
  embed: string
}

const EMPTY: FormValues = { embed: '' }

const PLACEHOLDER =
  '@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap");'

/**
 * Add or edit a font in the library.
 *
 * One field, and no client-side parsing of it. The pasted text goes to the
 * server exactly as typed and the server derives the family and the stylesheet
 * URL — the parser that rebuilds that URL from validated parts is the only
 * thing between a merchant's paste and a `<link>` on every page of the shop,
 * and a second implementation in the browser would be a second answer that can
 * disagree with it.
 *
 * On edit the box is seeded with the STORED URL rather than the original paste.
 * That is not a lossy shortcut: a bare URL is one of the accepted paste forms,
 * so an untouched field round-trips through exactly the same validation as a
 * fresh paste, and there is no unchecked "keep what's there" path.
 *
 * A rejection surfaces as the server's own message — "Only fonts.googleapis.com
 * stylesheets are accepted", "Poppins is already in the font library" — because
 * those are written for the merchant and a generic replacement would be worse.
 * `ResourceFormPage` never resets the form on a failed save, so the paste
 * survives the error and can be corrected.
 */
export default function FontFormPage() {
  const { fontId } = useParams()

  const { data, isLoading, error } = useFont(fontId)
  const createMutation = useCreateFont()
  const updateMutation = useUpdateFont()

  return (
    <ResourceFormPage<FormValues, Font>
      noun="Font"
      listPath={FONTS_PATH}
      recordId={fontId}
      record={data}
      isLoading={isLoading}
      loadError={error}
      emptyValues={EMPTY}
      toValues={(font) => ({ embed: font.url })}
      description="Pick a font on fonts.google.com, then paste what it gives you — the @import rule, the <link> tag, or just the URL."
      onSave={async (values) => {
        const embed = values.embed.trim()

        if (fontId) {
          await updateMutation.mutateAsync({ id: fontId, input: { embed } })
          return
        }

        const created = await createMutation.mutateAsync({ embed })
        return { id: created.id }
      }}
    >
      {() => (
        <>
          <Form.Item
            name="embed"
            label="Google Fonts embed"
            rules={[{ required: true, message: 'Paste the embed code from Google Fonts.' }]}
            extra="Only fonts.googleapis.com addresses are accepted. The font name is read from what you paste."
          >
            <Input.TextArea rows={4} spellCheck={false} placeholder={PLACEHOLDER} />
          </Form.Item>

          {data && (
            <div className="rounded-md border border-border bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">
                Currently <span className="font-medium text-foreground">{data.family}</span>
              </p>
              {/*
               * Rendered in the font itself. The stylesheet is loaded by the
               * library list's FontStylesheets when arriving from there; on a
               * direct load this falls back to the admin's own face, which is
               * honest — it shows what is available rather than faking it.
               */}
              <p
                className="mt-1 text-2xl leading-snug"
                style={{ fontFamily: `"${data.family}", system-ui, sans-serif` }}
              >
                Aa Bb Cc — 0123
              </p>
            </div>
          )}
        </>
      )}
    </ResourceFormPage>
  )
}
