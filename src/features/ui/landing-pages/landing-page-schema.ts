import { z } from 'zod'
import type { UseFormReturn } from 'react-hook-form'
import { numberWithDefault, optionalNumber, requiredNumber } from '@/lib/validation/numeric'
import {
  LANDING_PAGE_STATUSES,
  type LandingPageOrderForm,
} from '@/lib/api/landing-pages'

/**
 * The campaign page's form contract — schema, values, defaults.
 *
 * Its own module because `landing-page-form-page.tsx` and
 * `landing-page-lists.tsx` both need it, and neither can own it: the page
 * renders the lists, so a type living in the page would have the lists importing
 * their own parent. Splitting the non-component half out is the same move
 * `blog-media.ts` makes, and for the same second reason — a file exporting both
 * components and plain values loses fast refresh.
 *
 * See openspec/changes/remove-antd-from-admin, design.md Decision 3 for why the
 * two group rules are `superRefine`s rather than field rules.
 */

/** Mirrors the backend's `slugPattern`. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Mirrors the backend's `slugifyCampaignTitle`, so the preview matches what gets stored. */
export const slugify = (title: string) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Mirrors the backend's zone-key pattern. */
export const ZONE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const optionalText = z.string().optional()

const mediaRow = z
  .object({
    type: z.enum(['IMAGE', 'VIDEO']),
    url: z.string(),
    /** Poster frame for a VIDEO; ignored for an IMAGE. */
    thumbnailUrl: optionalText,
    alt: optionalText,
  })
  // Which of the two the row is missing depends on what kind of row it is, so
  // the rule cannot sit on `url` alone.
  .superRefine((row, ctx) => {
    if (row.url.trim()) return
    ctx.addIssue({
      code: 'custom',
      message: row.type === 'VIDEO' ? 'Add the video URL' : 'Add an image',
      path: ['url'],
    })
  })

const formField = z.object({
  label: z.string(),
  placeholder: optionalText,
  helper: optionalText,
})

export const schema = z.object({
  title: z.string().min(1, 'Give this campaign a name'),
  slug: optionalText.refine(
    (value) => !value?.trim() || SLUG_PATTERN.test(value.trim()),
    'Use lowercase words separated by single hyphens',
  ),
  status: z.enum(LANDING_PAGE_STATUSES),
  productId: z.string().min(1, 'Choose the product this page sells'),

  headline: z.string().min(1, 'Write the headline'),
  subheadline: optionalText,
  badgeText: optionalText,
  bodyHtml: z.string().min(1, 'Describe what you are selling'),

  media: z.array(mediaRow),
  highlights: z.array(
    z.object({
      icon: optionalText,
      title: z.string().min(1, 'Give this point a heading'),
      text: optionalText,
    }),
  ),
  faqs: z.array(
    z.object({
      question: z.string().min(1, 'Write the question'),
      answer: z.string().min(1, 'Write the answer'),
    }),
  ),
  quotes: z.array(
    z
      .object({
        name: z.string().min(1, 'Whose quote is this?'),
        /*
         * OPTIONAL, because a review may be a screenshot instead — the message
         * a customer actually sent. The refinement below is what keeps a card
         * from being empty; requiring this instead would force a merchant to
         * retype a message they already have a picture of.
         */
        text: optionalText,
        /*
         * antd's `InputNumber` clamped to its own min/max, so this bound could
         * never be reported; a native number input does not, so it needs words.
         * Phrased as the tax rule's percentage bound is.
         */
        rating: optionalNumber({ min: 1, max: 5, message: 'A rating is between 1 and 5' }),
        photoUrl: optionalText,
        /** The review itself as an image. */
        imageUrl: optionalText,
      })
      .refine((quote) => Boolean(quote.text?.trim() || quote.imageUrl?.trim()), {
        message: 'Add the review text, or a screenshot of it',
        path: ['text'],
      }),
  ),
  trustBadges: z.array(
    z.object({
      icon: optionalText,
      label: z.string().min(1, 'What does this badge say?'),
    }),
  ),

  /*
   * The tiers this campaign offers.
   *
   * `key` is generated once when a package is added and is NOT editable here —
   * an order records it, so letting a merchant rewrite it would reattach past
   * orders to a different tier. The two group rules below are `superRefine`s
   * for the reason design.md Decision 3 gives for the zones': a rule about the
   * whole list cannot be expressed on one field.
   */
  packages: z
    .array(
      z
        .object({
          key: z.string().min(1),
          label: z.string().min(1, 'Name this package'),
          productId: z.string().min(1, 'Choose the product this package sells'),
          price: requiredNumber('Enter the price', { min: 0, message: 'Enter a valid price' }),
          compareAtPrice: optionalNumber({ min: 0, message: 'Enter a valid price' }),
          freeGiftText: optionalText,
          badge: optionalText,
          preselected: z.boolean().optional(),
        })
        .refine(
          (pkg) =>
            pkg.compareAtPrice === undefined ||
            pkg.compareAtPrice === null ||
            pkg.compareAtPrice > pkg.price,
          {
            /*
             * A struck-through figure BELOW the price advertises a discount
             * that is a price increase — the one arithmetic error a shopper is
             * guaranteed to notice.
             */
            message: 'The struck-through price must be higher than the price charged',
            path: ['compareAtPrice'],
          },
        ),
    )
    .superRefine((packages, ctx) => {
      const preselected = packages
        .map((pkg, index) => ({ pkg, index }))
        .filter(({ pkg }) => pkg.preselected)

      if (preselected.length > 1) {
        ctx.addIssue({
          code: 'custom',
          path: [preselected[1]!.index, 'preselected'],
          message: 'Only one package can be preselected',
        })
      }
    }),

  whyUs: z.array(
    z.object({
      title: z.string().min(1, 'Write the reason'),
      text: optionalText,
    }),
  ),

  usageIdeas: z.array(
    z.object({
      label: z.string().min(1, 'Write the idea'),
      icon: optionalText,
    }),
  ),

  /*
   * An ISO instant from a datetime-local input, or empty for no countdown.
   * Never a duration — see LandingPage.prisma on why every visitor must count
   * down to the same moment.
   */
  offerEndsAt: optionalText,
  stopOrdersAtDeadline: z.boolean(),
  /*
   * The SIZE of a limited run. There is deliberately no field for how many have
   * been taken: the server counts that from real orders, and a field a merchant
   * could type into would be a number they would eventually type a flattering
   * value into.
   */
  scarcityTarget: optionalNumber({ min: 1, message: 'A run is at least 1' }),
  orderPhone: optionalText,
  /*
   * Whether this campaign collects money before it ships. The accounts come
   * from Checkout Setting — there is deliberately no account field here.
   */
  requiresAdvancePayment: z.boolean(),
  /*
   * The campaign's colour tokens, flat on the form rather than nested — the
   * form is a flat map and nesting one branch would make every field path
   * inconsistent with the rest. Reassembled into `theme` on save.
   *
   * Every one blank-able: blank means "the default", which the storefront's
   * globals.css supplies. There is deliberately no way to express "transparent".
   */
  themeAccent: optionalText,
  themeAccentSoft: optionalText,
  themeAccentContrast: optionalText,
  themeSurface: optionalText,
  themeSurfaceAlt: optionalText,
  themeText: optionalText,
  themeTextMuted: optionalText,
  themeBorder: optionalText,


  orderForm: z.object({
    heading: optionalText,
    subheading: optionalText,
    fields: z.object({
      fullName: formField.extend({
        label: z.string().min(1, 'Label the name field'),
        required: z.boolean(),
      }),
      phone: formField.extend({ label: z.string().min(1, 'Label the phone field') }),
      address: formField.extend({ label: z.string().min(1, 'Label the address field') }),
    }),
    submitLabel: z.string().min(1, 'Label the order button'),
    notice: optionalText,
  }),

  successHeading: optionalText,
  successMessage: optionalText,

  metaTitle: optionalText,
  metaDescription: optionalText,
  ogImageUrl: optionalText,
  facebookPixelId: optionalText.refine(
    (value) => !value?.trim() || /^\d{5,20}$/.test(value.trim()),
    'A Pixel ID is digits only',
  ),

  sortOrder: numberWithDefault(0),
})

/**
 * `price`, `rating` and `sortOrder` each run through a `z.preprocess`, so what
 * the boxes hold and what a valid submit produces are different types.
 */
export type FormValues = z.input<typeof schema>
export type OutputValues = z.output<typeof schema>

/** What the list fields are handed, so each owns its own `useFieldArray`. */
export type LandingPageForm = UseFormReturn<FormValues, unknown, OutputValues>

/**
 * What a NEW page starts with, mirroring the backend's own seed defaults.
 *
 * Duplicated here rather than fetched because the create form has no record to
 * read them from, and a merchant should see the Bangla labels they are about to
 * publish rather than empty boxes. The backend applies the same values when a
 * create payload omits them, so the two cannot diverge in behaviour — only in
 * what the merchant is shown before saving.
 */
export const DEFAULT_ORDER_FORM: LandingPageOrderForm = {
  heading: 'অর্ডার করতে নিচের ফর্মটি পূরণ করুন',
  subheading: 'আপনার তথ্য দিন, পণ্য হাতে পেয়ে টাকা পরিশোধ করুন।',
  fields: {
    fullName: { label: 'নাম', placeholder: 'আপনার সম্পূর্ণ নাম', required: true },
    phone: {
      label: 'মোবাইল নম্বর',
      placeholder: '01XXXXXXXXX',
      helper: 'অর্ডার কনফার্ম করতে আমরা এই নম্বরে কল করব।',
    },
    address: { label: 'ঠিকানা', placeholder: 'গ্রাম/রোড, থানা, জেলা' },
  },
  submitLabel: 'অর্ডার কনফার্ম করুন',
  notice: 'ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে টাকা দিন।',
}

export const EMPTY: FormValues = {
  title: '',
  slug: '',
  status: 'DRAFT',
  productId: '',
  headline: '',
  subheadline: '',
  badgeText: '',
  bodyHtml: '',
  media: [],
  highlights: [],
  faqs: [],
  quotes: [],
  trustBadges: [],
  packages: [],
  whyUs: [],
  usageIdeas: [],
  offerEndsAt: '',
  stopOrdersAtDeadline: false,
  scarcityTarget: undefined,
  orderPhone: '',
  requiresAdvancePayment: false,
  themeAccent: '',
  themeAccentSoft: '',
  themeAccentContrast: '',
  themeSurface: '',
  themeSurfaceAlt: '',
  themeText: '',
  themeTextMuted: '',
  themeBorder: '',
  orderForm: DEFAULT_ORDER_FORM,
  successHeading: '',
  successMessage: '',
  metaTitle: '',
  metaDescription: '',
  ogImageUrl: '',
  facebookPixelId: '',
  sortOrder: 0,
}
