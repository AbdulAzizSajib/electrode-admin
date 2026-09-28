import { useWatch } from 'react-hook-form'
import { ColorInput } from '@/components/ui/color-input'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import type { LandingPageForm } from './landing-page-schema'

/**
 * The campaign's colour tokens, with a live preview of them together.
 *
 * EIGHT TOKENS RATHER THAN ONE ACCENT, because one accent could only recolour
 * the handful of brand-coloured elements on the page. Everything else — every
 * surface, border and line of body text — used to be a grey typed into a
 * component, which no setting could reach. Now one value here moves every place
 * it is used.
 *
 * Named for what they DO, not what they look like. A merchant who sets
 * "alternate background" to a pale amber gets a page that still makes sense,
 * which "gray 50" would not.
 *
 * THE PREVIEW IS THE SAFETY RAIL, and it is deliberately the only one. Eight
 * free-form colours include grey text on a grey surface, and nothing refuses
 * that combination: a contrast validator that blocked a save would be a
 * merchant unable to use their own brand colours, and the shop's own theme
 * editor takes the same position. So the mistake is made VISIBLE before saving
 * rather than made impossible.
 *
 * See server/openspec/changes/add-landing-page-theme-tokens, design.md D2.
 */

type TokenField = {
  name:
    | 'themeAccent'
    | 'themeAccentSoft'
    | 'themeAccentContrast'
    | 'themeSurface'
    | 'themeSurfaceAlt'
    | 'themeText'
    | 'themeTextMuted'
    | 'themeBorder'
  label: string
  help: string
}

const TOKENS: TokenField[] = [
  { name: 'themeAccent', label: 'Accent', help: 'Buttons, badges and highlights.' },
  {
    name: 'themeAccentSoft',
    label: 'Accent background',
    help: 'The offer and call-to-action bands. A pale wash of the accent.',
  },
  {
    name: 'themeAccentContrast',
    label: 'Text on accent',
    help: 'What is readable on a button. Usually white.',
  },
  { name: 'themeSurface', label: 'Background', help: 'The main page background.' },
  {
    name: 'themeSurfaceAlt',
    label: 'Alternate background',
    help: 'Every other section, so the page reads as bands rather than one column.',
  },
  { name: 'themeText', label: 'Text', help: 'Headings and body copy.' },
  { name: 'themeTextMuted', label: 'Secondary text', help: 'Captions and supporting lines.' },
  { name: 'themeBorder', label: 'Borders', help: 'Card edges and dividing rules.' },
]

export function ThemeTokenFields({ form }: { form: LandingPageForm }) {
  const values = useWatch({ control: form.control })

  /*
   * The preview falls back to the SAME defaults the storefront's globals.css
   * declares, so an unset token previews as what the page will actually render
   * rather than as blank. These are the one place in the admin that mirrors
   * those values; keep them in step.
   */
  const preview = {
    accent: values.themeAccent?.trim() || '#0f63b3',
    accentSoft: values.themeAccentSoft?.trim() || '#f2f6fb',
    accentContrast: values.themeAccentContrast?.trim() || '#ffffff',
    surface: values.themeSurface?.trim() || '#ffffff',
    surfaceAlt: values.themeSurfaceAlt?.trim() || '#f9fafb',
    text: values.themeText?.trim() || '#111827',
    muted: values.themeTextMuted?.trim() || '#4b5563',
    border: values.themeBorder?.trim() || '#e5e7eb',
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        {TOKENS.map((token) => (
          <FormField
            key={token.name}
            control={form.control}
            name={token.name}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{token.label}</FormLabel>
                <FormControl>
                  <ColorInput
                    value={field.value}
                    onChange={(next) => field.onChange(next ?? '')}
                    onBlur={field.onBlur}
                  />
                </FormControl>
                <FormDescription>
                  {token.help} Left blank, your shop&apos;s default is used.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
      </div>

      {/*
        The tokens rendered TOGETHER, which is the only way an unreadable
        combination shows itself — each swatch alone always looks fine.
      */}
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Preview</p>
        <div
          className="overflow-hidden rounded-lg border"
          style={{ borderColor: preview.border }}
        >
          <div className="p-4" style={{ background: preview.surface }}>
            <p className="text-sm font-semibold" style={{ color: preview.text }}>
              এখানে আপনার শিরোনাম থাকবে
            </p>
            <p className="mt-1 text-xs" style={{ color: preview.muted }}>
              আর এখানে ছোট বর্ণনা — এই দুটো রঙ একসাথে পড়া যাচ্ছে কি না দেখে নিন।
            </p>
            <span
              className="mt-3 inline-block rounded-md px-3 py-1.5 text-xs font-semibold"
              style={{ background: preview.accent, color: preview.accentContrast }}
            >
              অর্ডার কনফার্ম করুন
            </span>
          </div>

          <div
            className="border-t p-4"
            style={{ background: preview.surfaceAlt, borderColor: preview.border }}
          >
            <p className="text-xs" style={{ color: preview.muted }}>
              এটি পরের ব্যান্ড — আগেরটির থেকে আলাদা দেখানো উচিত।
            </p>
          </div>

          <div
            className="border-t p-4 text-center"
            style={{ background: preview.accentSoft, borderColor: preview.border }}
          >
            <p className="text-xs font-medium" style={{ color: preview.text }}>
              অফার ও কল-টু-অ্যাকশন ব্যান্ড
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
