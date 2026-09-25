import { Lock, TriangleAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/components/ui/use-toast'
import { AccountIconField } from '@/features/ui/checkout-settings/account-icon-field'
import {
  EditorActions,
  EditorRow,
  EditorSection,
  EditorSubsection,
  UnsavedChangesDialog,
} from '@/features/ui/components/settings-editor'
import {
  moveItem,
  useSettingsDraft,
  useUnsavedChangesGuard,
} from '@/features/ui/components/settings-editor-utils'
import { formatCurrency } from '@/lib/utils/format'
import {
  useStoreSettings,
  useUpdateStoreSettings,
  CHECKOUT_FIELD_KEYS,
  CHECKOUT_FIELD_LABELS,
  DEFAULT_ADVANCE_PAYMENT,
  DEFAULT_CHECKOUT_CONFIG,
  LOCKED_CHECKOUT_FIELDS,
  MAX_DELIVERY_OPTIONS,
  MAX_PAYMENT_ACCOUNTS,
  MOBILE_BANKING_PROVIDERS,
  SETTINGS_LIMITS,
  type AdvancePaymentConfig,
  type BankAccount,
  type CheckoutConfig,
  type CheckoutFieldKey,
  type DeliveryKind,
  type DeliveryOption,
  type MobileBankingAccount,
  type MobileBankingProvider,
} from '@/lib/api/store-settings'

/**
 * What the storefront's checkout page asks customers for.
 *
 * Writes ONLY `checkoutConfig`. `PATCH /settings` is a partial upsert, so this
 * page and the other settings editors are saved independently without any of
 * them clobbering another — the same disjoint-field-set arrangement Header
 * Links and Footer Links already rely on.
 *
 * The important property of this page is that it cannot express a configuration
 * the backend would reject. Hiding a field clears its Required box in the same
 * interaction, and the mobile number row is locked outright — so the merchant
 * never composes a payload, presses Save, and has to decode a 400.
 */

const TITLE = 'Checkout settings'
const DESCRIPTION =
  "Controls what the website's checkout page asks customers for, the delivery options they pick from, what an order has to be worth to earn free delivery, and whether money is collected before an order ships."

/** Explains each locked row, shown beside its padlock. */
const LOCK_REASON: Partial<Record<CheckoutFieldKey, string>> = {
  phone:
    'Order tracking and the cash-on-delivery limit are both keyed on the mobile number, so it cannot be hidden or made optional.',
}

/**
 * Turning City off is legitimate, and — since delivery stopped being priced by
 * matching an address — no longer affects what a shopper is charged at all. The
 * warning stays, but it now says the thing that is actually true: the city is
 * what a courier needs to find the door, not a pricing input.
 */
const CITY_WARNING =
  'Delivery is priced by the option the shopper picks below, not by their address, so turning City off does not change what anyone is charged. It is still what a courier needs to find the address — leave it on unless you deliver to one city only.'

/**
 * The key for a NEWLY ADDED option, generated once here and never rewritten.
 *
 * Generated in the client because that is where the option is created; the
 * backend only ever validates the shape. Renaming an option must not touch its
 * key — the key is what keeps "how many orders chose Inside Dhaka" answerable
 * across a rename, while the label is what each order captured at the time.
 *
 * The label is not yet typed when a row is added, so the key is positional and
 * simply has to be unique and stable, not descriptive. A merchant never sees it.
 */
const newOptionKey = (taken: DeliveryOption[]): string => {
  const existing = new Set(taken.map((option) => option.key))
  let n = existing.size + 1
  while (existing.has(`option-${n}`)) n++
  return `option-${n}`
}

/** The label a merchant reads for each mobile-money service. */
const PROVIDER_LABELS: Record<MobileBankingProvider, string> = {
  BKASH: 'bKash',
  NAGAD: 'Nagad',
  ROCKET: 'Rocket',
}

/**
 * The id for a NEWLY ADDED payment account — generated once and NEVER rewritten.
 *
 * Stricter than `newOptionKey` above, and the difference is the whole point. A
 * delivery key only has to survive a rename; this id is referenced by every
 * placed order's payment row, so it must survive reordering and deletion too.
 * Drawn from a counter across BOTH lists because the backend refuses a duplicate
 * id whichever list it sits in — a mobile account and a bank account cannot
 * share one.
 */
const newAccountId = (advance: AdvancePaymentConfig): string => {
  const taken = new Set([
    ...advance.mobileAccounts.map((account) => account.id),
    ...advance.bankAccounts.map((account) => account.id),
  ])
  let n = taken.size + 1
  while (taken.has(`account-${n}`)) n++
  return `account-${n}`
}

/**
 * Bangladeshi mobile numbers, as `normalizePhone` in the backend's
 * `src/app/utils/phone.ts` accepts them: any of the ways one gets typed, with
 * separators, reducing to `+8801[3-9]XXXXXXXX`.
 *
 * Duplicated here rather than deferred to the server because of what this page
 * promises — see the file comment: a merchant must not compose a payload, press
 * Save, and have to decode a 400. That is the opposite call from
 * `order-create-page.tsx`, which is looser on purpose: there an operator is
 * reading a number off a live call, and a refusal costs the sale. Here the
 * merchant is typing their own account number from memory, and a wrong one is
 * money sent to nobody.
 */
const isValidMobileNumber = (input: string): boolean => {
  const cleaned = input.trim().replace(/[\s\-().]/g, '')
  if (!/^\+?\d+$/.test(cleaned)) return false
  const digits = cleaned.replace(/^\+/, '')
  // Longest prefix first, matching the backend: "00880" also starts with "0".
  const national = digits.startsWith('00880')
    ? digits.slice(5)
    : digits.startsWith('880')
      ? digits.slice(3)
      : digits.startsWith('0')
        ? digits.slice(1)
        : digits
  return /^1[3-9]\d{8}$/.test(national)
}

/**
 * The per-row advance-payment errors, on the same terms as `validateDelivery`:
 * the message lands beside the offending account rather than arriving as a 400
 * naming a path the merchant has to count rows to find.
 *
 * Two maps rather than one because the two lists are rendered separately and a
 * row index means nothing without knowing which list it indexes.
 */
interface AdvancePaymentErrors {
  mobile: Record<number, string>
  bank: Record<number, string>
}

const validateAdvancePayment = (advance: AdvancePaymentConfig): AdvancePaymentErrors => {
  const mobile: Record<number, string> = {}
  const bank: Record<number, string> = {}

  /*
   * A DUPLICATE IS THE SAME NUMBER ON THE SAME SERVICE — not the same number.
   *
   * One phone number ordinarily carries a bKash account and a Nagad account at
   * the same time; that is how mobile money works here, and most merchants
   * register both on the number they already give out. Keying this on the
   * number alone refused the second one, so a shop that takes bKash and Nagad
   * on one line could not say so.
   *
   * The same number twice on ONE service is still a mistake: it offers the
   * shopper a choice that is not a choice, and makes "which account was this
   * claim sent to" unanswerable by eye.
   *
   * Not a backend rule in either direction — the server dedupes account ids and
   * nothing else — so this is the only place the rule is stated.
   */
  const seenAccounts = new Map<string, number>()

  advance.mobileAccounts.forEach((account, index) => {
    const number = account.number.trim()

    if (number === '') {
      mobile[index] = 'Give this account a number — a shopper has nowhere to send money without one.'
      return
    }
    if (!isValidMobileNumber(number)) {
      mobile[index] = 'That is not a Bangladeshi mobile number. Enter it as 01XXXXXXXXX.'
      return
    }

    const firstSeen = seenAccounts.get(`${account.provider}:${number}`)
    if (firstSeen !== undefined) {
      // Naming the service is what makes the message true: the merchant is
      // being told this pair repeats, not that the number is spoken for.
      mobile[index] = `Already entered as account ${firstSeen + 1} — the same ${PROVIDER_LABELS[account.provider]} number twice is one account, not two.`
      return
    }
    seenAccounts.set(`${account.provider}:${number}`, index)
  })

  advance.bankAccounts.forEach((account, index) => {
    if (account.bankName.trim() === '') {
      bank[index] = 'Name the bank — a shopper needs it to make the transfer.'
      return
    }
    if (account.accountName.trim() === '') {
      // The one error nothing on the merchant's side can undo: a deposit slip
      // made out to the wrong name. The backend refuses a blank for the same
      // reason; this says so before the save.
      bank[index] = 'Give the account name exactly as the bank holds it — a slip made out to the wrong name cannot be recovered.'
      return
    }
    if (account.accountNumber.trim() === '') {
      bank[index] = 'Give the account number.'
    }
  })

  return { mobile, bank }
}

/**
 * The per-row delivery errors, mirroring the backend's rules so the message
 * lands beside the offending row instead of arriving as a 400 the merchant has
 * to map back onto a list.
 *
 * Keyed by row index; the list-level problems (empty list, collection with
 * nothing to collect from) are returned separately because they belong to the
 * section, not to any one row.
 */
interface DeliveryErrors {
  rows: Record<number, string>
  emptyList?: string
  pickup?: string
}

const validateDelivery = (
  options: DeliveryOption[],
  offersPickup: boolean,
): DeliveryErrors => {
  const rows: Record<number, string> = {}
  const seenLabels = new Map<string, number>()

  options.forEach((option, index) => {
    const label = option.label.trim()

    if (label === '') {
      rows[index] = 'Give this option a name — a shopper cannot tell an unnamed option apart.'
      return
    }

    // Case-insensitive, matching the backend: two options a shopper reads as
    // the same name are one choice they cannot express a preference between.
    const key = label.toLowerCase()
    const firstSeen = seenLabels.get(key)
    if (firstSeen !== undefined) {
      rows[index] = `Already used by option ${firstSeen + 1} — two options cannot share a name.`
      return
    }
    seenLabels.set(key, index)
  })

  return {
    rows,
    emptyList:
      options.length === 0
        ? 'Add at least one delivery option — a store that takes orders has to be able to say what delivery costs.'
        : undefined,
    pickup:
      offersPickup && !options.some((option) => option.kind === 'PICKUP')
        ? 'No option is marked as a pickup point, so a shopper choosing collection would have nothing to choose. Mark one as a pickup point, or turn collection off.'
        : undefined,
  }
}

/**
 * What this page edits, as one value.
 *
 * `freeShippingThreshold` is a scalar column, not part of the `checkoutConfig` blob — it is a typed
 * decimal the order-pricing path reads directly, and burying it in a JSON column that Postgres does
 * not constrain, purely to keep one screen's fields in one column, would be the wrong trade. But it
 * IS edited here, so it has to ride in the same draft: the unsaved-changes guard tracks the draft,
 * and a threshold outside it would be silently discarded on navigation.
 *
 * `thresholdText` is the raw input string rather than a number, so "" (no offer) stays
 * distinguishable from "0" (every order free) while the merchant is typing.
 */
interface CheckoutDraft {
  config: CheckoutConfig
  thresholdText: string
}

/** `null` -> "" — a cleared threshold and an untouched one look the same in an input. */
const thresholdToText = (value: number | null | undefined) =>
  value === null || value === undefined ? '' : String(value)

/**
 * Back the other way, preserving the distinction the column cares about.
 *
 * Blank means `null`, which the backend now accepts as "withdraw the offer" — this is the half of
 * the fix that makes a threshold clearable at all. Before, a blank field was simply omitted from the
 * payload, and under a partial upsert an omitted key means "leave unchanged".
 */
const textToThreshold = (text: string): number | null => {
  const trimmed = text.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export default function CheckoutSettingsPage() {
  const { data, isLoading, error } = useStoreSettings()
  const updateMutation = useUpdateStoreSettings()

  const draft = useSettingsDraft<CheckoutDraft>(
    // An unconfigured store seeds from the same defaults the backend falls back
    // to, so the form shows what checkout is actually doing rather than blanks.
    data && {
      config: data.checkoutConfig ?? DEFAULT_CHECKOUT_CONFIG,
      thresholdText: thresholdToText(data.freeShippingThreshold),
    },
    { config: DEFAULT_CHECKOUT_CONFIG, thresholdText: '' },
  )
  const blocker = useUnsavedChangesGuard(draft.isDirty)

  const config = draft.value.config
  const thresholdText = draft.value.thresholdText
  const setConfig = (patch: Partial<CheckoutConfig>) =>
    draft.set({ ...draft.value, config: { ...config, ...patch } })
  const setThresholdText = (text: string) => draft.set({ ...draft.value, thresholdText: text })

  /* Shown beneath the field so the merchant reads the threshold in their own currency. */
  const thresholdPreview = (() => {
    const value = textToThreshold(thresholdText)
    if (value === null) return null
    return formatCurrency(value)
  })()

  const isLocked = (key: CheckoutFieldKey) => LOCKED_CHECKOUT_FIELDS.includes(key)

  const setShow = (key: CheckoutFieldKey, show: boolean) => {
    if (isLocked(key)) return
    setConfig({
      fields: {
        ...config.fields,
        // Clearing Required alongside Show is what keeps the contradictory
        // state — hidden and required — unreachable from this form.
        [key]: { show, required: show && config.fields[key].required },
      },
    })
  }

  const setRequired = (key: CheckoutFieldKey, required: boolean) => {
    if (isLocked(key)) return
    setConfig({
      fields: { ...config.fields, [key]: { ...config.fields[key], required } },
    })
  }

  /* ---------------------------------------------------------------- *
   * Delivery options
   * ---------------------------------------------------------------- */

  // A config stored before delivery moved here has no `delivery` key at all.
  // The backend fills it in on read, but the form must not depend on that
  // having happened to render.
  const delivery = config.delivery ?? DEFAULT_CHECKOUT_CONFIG.delivery
  const options = delivery.options
  const deliveryErrors = validateDelivery(options, delivery.offersPickup)
  const hasDeliveryErrors =
    Object.keys(deliveryErrors.rows).length > 0 ||
    deliveryErrors.emptyList !== undefined ||
    deliveryErrors.pickup !== undefined

  const setDelivery = (patch: Partial<CheckoutConfig['delivery']>) =>
    setConfig({ delivery: { ...delivery, ...patch } })

  const setOptions = (next: DeliveryOption[]) => setDelivery({ options: next })

  const patchOption = (index: number, patch: Partial<DeliveryOption>) =>
    setOptions(options.map((option, i) => (i === index ? { ...option, ...patch } : option)))

  const addOption = () =>
    setOptions([
      ...options,
      // Priced at 0 rather than a guessed amount: a merchant must state what
      // delivery costs, and 0 is a legitimate answer (free delivery to an area)
      // that they have to choose rather than inherit.
      { key: newOptionKey(options), label: '', kind: 'DELIVERY', price: 0, days: 0 },
    ])

  const removeOption = (index: number) => {
    const next = options.filter((_, i) => i !== index)
    setDelivery({
      options: next,
      // Removing the last pickup point turns collection off with it, rather
      // than leaving a saved-but-unsavable state the merchant has to untangle.
      offersPickup: delivery.offersPickup && next.some((option) => option.kind === 'PICKUP'),
    })
  }

  const setOptionKind = (index: number, kind: DeliveryKind) => {
    const next = options.map((option, i) => (i === index ? { ...option, kind } : option))
    setDelivery({
      options: next,
      offersPickup: delivery.offersPickup && next.some((option) => option.kind === 'PICKUP'),
    })
  }

  /* ---------------------------------------------------------------- *
   * Advance payment accounts
   * ---------------------------------------------------------------- */

  // An absent `advancePayment` and an explicitly disabled one mean the same
  // thing by design, so the form reads both as this. Same reason the delivery
  // block above falls back: the form must render without depending on the
  // backend having normalised the value first.
  const advance = config.advancePayment ?? DEFAULT_ADVANCE_PAYMENT
  const mobileAccounts = advance.mobileAccounts
  const bankAccounts = advance.bankAccounts
  const hasAnyAccount = mobileAccounts.length > 0 || bankAccounts.length > 0
  const advanceErrors = validateAdvancePayment(advance)
  const hasAdvanceErrors =
    Object.keys(advanceErrors.mobile).length > 0 || Object.keys(advanceErrors.bank).length > 0

  const setAdvance = (patch: Partial<AdvancePaymentConfig>) =>
    setConfig({ advancePayment: { ...advance, ...patch } })

  /**
   * Every write to either list goes through here so the "enabled with no
   * accounts" state is unreachable rather than merely discouraged. Removing the
   * last account turns the feature off with it — the same move `removeOption`
   * makes for the last pickup point, and for the same reason: leaving a
   * saved-but-unsavable state is worse than acting on the merchant's behalf.
   */
  const setAccounts = (next: Partial<Pick<AdvancePaymentConfig, 'mobileAccounts' | 'bankAccounts'>>) => {
    const mobile = next.mobileAccounts ?? mobileAccounts
    const bank = next.bankAccounts ?? bankAccounts
    setAdvance({
      mobileAccounts: mobile,
      bankAccounts: bank,
      enabled: advance.enabled && (mobile.length > 0 || bank.length > 0),
    })
  }

  const addMobileAccount = () =>
    setAccounts({
      mobileAccounts: [
        ...mobileAccounts,
        // bKash first because it is the one a Bangladeshi shop sets up first,
        // not because anything branches on it. The number is blank: there is no
        // guessable default, and an account nobody typed is money sent nowhere.
        { id: newAccountId(advance), provider: 'BKASH', number: '', accountType: '' },
      ],
    })

  const patchMobileAccount = (index: number, patch: Partial<MobileBankingAccount>) =>
    setAccounts({
      // Patches the fields ONLY. `id` is generated when the row is added and
      // never rewritten — see `newAccountId`. Changing a number here leaves
      // every claim already sent to the old one still readable, because the
      // payment row snapshotted the details it displayed at placement.
      mobileAccounts: mobileAccounts.map((account, i) =>
        i === index ? { ...account, ...patch } : account,
      ),
    })

  const removeMobileAccount = (index: number) =>
    setAccounts({ mobileAccounts: mobileAccounts.filter((_, i) => i !== index) })

  const addBankAccount = () =>
    setAccounts({
      bankAccounts: [
        ...bankAccounts,
        {
          id: newAccountId(advance),
          bankName: '',
          accountName: '',
          accountNumber: '',
          branch: '',
          routingNumber: '',
        },
      ],
    })

  const patchBankAccount = (index: number, patch: Partial<BankAccount>) =>
    setAccounts({
      bankAccounts: bankAccounts.map((account, i) =>
        i === index ? { ...account, ...patch } : account,
      ),
    })

  const removeBankAccount = (index: number) =>
    setAccounts({ bankAccounts: bankAccounts.filter((_, i) => i !== index) })

  const save = async () => {
    // The form says no before the API does. Without this the merchant would get
    // a 400 whose message they would have to map back onto a row by hand — the
    // per-row errors above are already showing exactly which one is wrong.
    if (hasDeliveryErrors) {
      toast({
        title: 'Check the delivery options',
        description:
          deliveryErrors.emptyList ??
          deliveryErrors.pickup ??
          'One of the delivery options needs fixing before this can be saved.',
        variant: 'destructive',
      })
      return
    }

    // Same contract for the payment accounts: the per-row messages are already
    // pointing at the offending account, so the toast names the section and
    // leaves the detail where the merchant can act on it.
    if (hasAdvanceErrors) {
      toast({
        title: 'Check the payment accounts',
        description:
          'One of the accounts a shopper would send money to needs fixing before this can be saved.',
        variant: 'destructive',
      })
      return
    }

    try {
      /*
       * Two keys and only two. `PATCH /settings` is a partial upsert, so this page and the other
       * settings editors stay independent — Header Links sends `mainNav`, Site Setting sends the
       * branding scalars and `theme`, Store Settings sends the currency fields and contact details.
       * The threshold is now exclusively this page's; Store Settings no longer sends it, which is
       * what keeps the two from disagreeing.
       */
      await updateMutation.mutateAsync({
        checkoutConfig: config,
        freeShippingThreshold: textToThreshold(thresholdText),
      })
      draft.markSaved(draft.value)
      toast({ title: 'Checkout settings saved' })
    } catch (err) {
      toast({
        title: 'Could not save the checkout settings',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load the checkout settings.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={TITLE} description={DESCRIPTION} />

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead className="text-center">Show on checkout</TableHead>
              <TableHead className="text-center">Required</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CHECKOUT_FIELD_KEYS.map((key) => {
              const field = config.fields[key]
              const locked = isLocked(key)
              // Only meaningful for City, and only once it stops being required.
              const showCityWarning = key === 'city' && (!field.show || !field.required)

              return (
                <TableRow key={key}>
                  <TableCell className="align-top">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-1.5 font-medium text-foreground">
                        {CHECKOUT_FIELD_LABELS[key]}
                        {locked && <Lock className="size-3.5 text-muted-foreground" />}
                      </span>
                      {locked && LOCK_REASON[key] && (
                        <span className="max-w-lg text-xs text-muted-foreground">
                          {LOCK_REASON[key]}
                        </span>
                      )}
                      {showCityWarning && (
                        <span className="flex max-w-lg items-start gap-1.5 text-xs text-amber-600">
                          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                          {CITY_WARNING}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center align-top">
                    <Checkbox
                      checked={field.show}
                      disabled={locked}
                      onCheckedChange={(checked) => setShow(key, checked === true)}
                      aria-label={`Show ${CHECKOUT_FIELD_LABELS[key]} on checkout`}
                    />
                  </TableCell>
                  <TableCell className="text-center align-top">
                    <Checkbox
                      checked={field.required}
                      // Required is meaningless for a field that is not shown,
                      // and the backend rejects the combination outright.
                      disabled={locked || !field.show}
                      onCheckedChange={(checked) => setRequired(key, checked === true)}
                      aria-label={`Make ${CHECKOUT_FIELD_LABELS[key]} required`}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <Switch
            id="show-coupon-box"
            checked={config.showCouponBox}
            onCheckedChange={(checked) => setConfig({ showCouponBox: checked })}
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="show-coupon-box">Show coupon code box</Label>
            <span className="text-xs text-muted-foreground">
              Appears on both the cart and the checkout page. A discount a shopper has already
              applied stays honoured either way.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Switch
            id="show-order-note"
            checked={config.showOrderNote}
            onCheckedChange={(checked) => setConfig({ showOrderNote: checked })}
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="show-order-note">Show order note box</Label>
            <span className="text-xs text-muted-foreground">
              Lets a customer add a delivery instruction to their order.
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Switch
            id="allow-guest-checkout"
            checked={config.allowGuestCheckout}
            onCheckedChange={(checked) => setConfig({ allowGuestCheckout: checked })}
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="allow-guest-checkout">
              Allow guest checkout (order without signing in)
            </Label>
            <span className="text-xs text-muted-foreground">
              {config.allowGuestCheckout
                ? 'Shoppers can order without an account.'
                : 'Shoppers are sent to sign in before they can order.'}
            </span>
          </div>
        </div>
      </Card>

      <EditorSection
        title="Delivery"
        description="What a shopper picks from at checkout. Each option is charged exactly as priced here — nothing is worked out from the address they type."
        onAdd={addOption}
        addLabel="Add option"
        atCapacity={options.length >= MAX_DELIVERY_OPTIONS}
        capacityNote={`${MAX_DELIVERY_OPTIONS} options at most — past that the checkout is a wall of radio buttons rather than a choice.`}
      >
        {options.length === 0 ? (
          <p className="rounded-md border border-destructive p-3 text-xs text-destructive">
            {deliveryErrors.emptyList} Until one is added, checkout refuses to price an order.
          </p>
        ) : (
          options.map((option, index) => (
            <EditorRow
              key={option.key}
              index={index}
              count={options.length}
              onMove={(from, to) => setOptions(moveItem(options, from, to))}
              onRemove={() => removeOption(index)}
              error={deliveryErrors.rows[index]}
              removeLabel={`Remove ${option.label.trim() || 'this option'}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Label htmlFor={`delivery-label-${option.key}`} className="text-xs">
                    Name the shopper sees
                  </Label>
                  <Input
                    id={`delivery-label-${option.key}`}
                    value={option.label}
                    maxLength={120}
                    placeholder="e.g. Inside Dhaka"
                    // Deliberately patches the label ONLY. The key was generated
                    // when the row was added and is never rewritten, so renaming
                    // an option does not re-bucket the orders placed under it.
                    onChange={(e) => patchOption(index, { label: e.target.value })}
                  />
                </div>

                <div className="flex w-full flex-col gap-1 sm:w-28">
                  <Label htmlFor={`delivery-price-${option.key}`} className="text-xs">
                    Price
                  </Label>
                  <Input
                    id={`delivery-price-${option.key}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={option.price}
                    onChange={(e) => patchOption(index, { price: Number(e.target.value) || 0 })}
                  />
                </div>

                <div className="flex w-full flex-col gap-1 sm:w-24">
                  <Label htmlFor={`delivery-days-${option.key}`} className="text-xs">
                    Days
                  </Label>
                  <Input
                    id={`delivery-days-${option.key}`}
                    type="number"
                    step="1"
                    min="0"
                    value={option.days}
                    onChange={(e) =>
                      patchOption(index, { days: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })
                    }
                  />
                </div>

                <div className="flex w-full flex-col gap-1 sm:w-40">
                  <Label htmlFor={`delivery-kind-${option.key}`} className="text-xs">
                    Type
                  </Label>
                  <select
                    id={`delivery-kind-${option.key}`}
                    className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={option.kind}
                    onChange={(e) => setOptionKind(index, e.target.value as DeliveryKind)}
                  >
                    <option value="DELIVERY">Delivery area</option>
                    <option value="PICKUP">Pickup point</option>
                  </select>
                </div>
              </div>

              <span className="text-xs text-muted-foreground">
                {option.kind === 'PICKUP'
                  ? 'Collected in person, so the checkout stops asking this shopper for a delivery address.'
                  : 'Delivered to the address the shopper gives.'}{' '}
                Charged {formatCurrency(option.price)}
                {option.days > 0 ? `, in about ${option.days} day${option.days === 1 ? '' : 's'}` : ''}.
              </span>
            </EditorRow>
          ))
        )}

        <div className="flex items-start gap-3 border-t pt-3">
          <Checkbox
            id="offers-pickup"
            checked={delivery.offersPickup}
            // Cannot be turned ON without somewhere to collect from — the same
            // rule the backend enforces, said here before a save is attempted.
            disabled={!delivery.offersPickup && !options.some((o) => o.kind === 'PICKUP')}
            onCheckedChange={(checked) => setDelivery({ offersPickup: checked === true })}
            aria-label="Offer collection in person"
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="offers-pickup">Offer collection in person</Label>
            <span className="max-w-xl text-xs text-muted-foreground">
              {delivery.offersPickup
                ? 'Shoppers are asked whether they want the order delivered or will collect it, then shown the matching list.'
                : 'Shoppers are shown the delivery areas alone. Any pickup points below are kept but not offered, so collection can be resumed later without re-entering them.'}
            </span>
            {deliveryErrors.pickup && (
              <span className="flex max-w-xl items-start gap-1.5 pt-1 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                {deliveryErrors.pickup}
              </span>
            )}
            {!delivery.offersPickup && !options.some((o) => o.kind === 'PICKUP') && (
              <span className="max-w-xl pt-1 text-xs text-muted-foreground">
                Mark an option as a pickup point above to enable this.
              </span>
            )}
          </div>
        </div>
      </EditorSection>

      <Card className="flex flex-col gap-2 p-4">
        <Label htmlFor="free-shipping-threshold">Free shipping over</Label>
        <Input
          id="free-shipping-threshold"
          type="number"
          step="0.01"
          min="0"
          value={thresholdText}
          placeholder="Leave blank for no free shipping offer"
          onChange={(e) => setThresholdText(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {/* Three states, and a merchant has to be able to tell them apart. The
              old Store Settings field could only express two: it dropped a blank
              value from the payload, which a partial upsert reads as "leave
              unchanged" — so an offer, once set, could never be withdrawn. */}
          {thresholdText.trim() === '' ? (
            <>Blank — no free shipping by order value. Delivery is charged on every order.</>
          ) : thresholdPreview === formatCurrency(0) ? (
            <>Every order gets free delivery, whatever it is worth.</>
          ) : (
            <>Orders of {thresholdPreview} or more get free delivery.</>
          )}{' '}
          Collection in person is never free — that price is what the pickup location charges for it.
        </span>
      </Card>

      <EditorSection
        title="Advance payment"
        description="Takes money before the order ships. A shopper sends it to one of the accounts below by bKash, Nagad, Rocket or bank transfer, types the reference, and an order waits until someone here checks the statement and verifies it."
      >
        <div className="flex items-start gap-3">
          <Switch
            id="advance-payment-enabled"
            checked={advance.enabled}
            /*
             * Cannot be turned ON with nowhere to send money — the backend
             * refuses that save outright, and a checkout asking for a
             * transaction id against no account is the reason it does. Said
             * here so the merchant reads it before composing the payload rather
             * than as a 400 afterwards.
             */
            disabled={!advance.enabled && !hasAnyAccount}
            onCheckedChange={(checked) => setAdvance({ enabled: checked })}
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="advance-payment-enabled">Ask for payment before shipping</Label>
            <span className="max-w-xl text-xs text-muted-foreground">
              {advance.enabled
                ? 'Checkout offers two choices: send the delivery charge now and pay the rest at the door, or send the whole total now. Either way the order is held until the payment is verified.'
                : 'Checkout is cash on delivery only. Nothing is collected up front and no payment choice is shown.'}
            </span>
            {!advance.enabled && !hasAnyAccount && (
              <span className="max-w-xl pt-1 text-xs text-muted-foreground">
                Add an account below to enable this.
              </span>
            )}
            {advance.enabled && (
              <span className="flex max-w-xl items-start gap-1.5 pt-1 text-xs text-amber-600">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                Nothing checks that the money arrived. An order stays put until someone here reads
                the statement and verifies the claim, so orders pile up if nobody does.
              </span>
            )}
          </div>
        </div>

        <EditorSubsection
          title="Mobile banking accounts"
          description="Shown to the shopper with the number to send to. The account type is your own label — Personal, Merchant, Agent. An icon is optional: leave it empty and checkout shows the service's own mark."
          onAdd={addMobileAccount}
          addLabel="Add mobile account"
          atCapacity={mobileAccounts.length >= MAX_PAYMENT_ACCOUNTS}
          capacityNote={`${MAX_PAYMENT_ACCOUNTS} accounts at most.`}
        >
          {mobileAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              None yet. Add the bKash, Nagad or Rocket number a shopper should send to.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {mobileAccounts.map((account, index) => (
                <EditorRow
                  key={account.id}
                  index={index}
                  count={mobileAccounts.length}
                  onMove={(from, to) =>
                    setAccounts({ mobileAccounts: moveItem(mobileAccounts, from, to) })
                  }
                  onRemove={() => removeMobileAccount(index)}
                  error={advanceErrors.mobile[index]}
                  removeLabel={`Remove ${PROVIDER_LABELS[account.provider]} ${account.number.trim() || 'account'}`}
                >
                  {(errorId) => (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      {/*
                        First in the row because it is what the shopper sees
                        first on the card this configures — and because it is the
                        one control here with a fixed width, so it cannot be the
                        thing that gets squeezed.
                      */}
                      <AccountIconField
                        inputId={`mobile-icon-${account.id}`}
                        value={account.iconUrl ?? ''}
                        onChange={(iconUrl) => patchMobileAccount(index, { iconUrl })}
                        accountLabel={`${PROVIDER_LABELS[account.provider]} ${account.number.trim() || 'account'}`}
                      />

                      <div className="flex w-full flex-col gap-1 sm:w-36">
                        <Label htmlFor={`mobile-provider-${account.id}`} className="text-xs">
                          Service
                        </Label>
                        <select
                          id={`mobile-provider-${account.id}`}
                          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          value={account.provider}
                          onChange={(e) =>
                            patchMobileAccount(index, {
                              provider: e.target.value as MobileBankingProvider,
                            })
                          }
                        >
                          {MOBILE_BANKING_PROVIDERS.map((provider) => (
                            <option key={provider} value={provider}>
                              {PROVIDER_LABELS[provider]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <Label htmlFor={`mobile-number-${account.id}`} className="text-xs">
                          Number
                        </Label>
                        <Input
                          id={`mobile-number-${account.id}`}
                          value={account.number}
                          maxLength={20}
                          inputMode="tel"
                          placeholder="01XXXXXXXXX"
                          aria-invalid={errorId !== undefined}
                          aria-describedby={errorId}
                          onChange={(e) => patchMobileAccount(index, { number: e.target.value })}
                        />
                      </div>

                      <div className="flex w-full flex-col gap-1 sm:w-40">
                        <Label htmlFor={`mobile-type-${account.id}`} className="text-xs">
                          Account type
                        </Label>
                        <Input
                          id={`mobile-type-${account.id}`}
                          value={account.accountType}
                          maxLength={40}
                          placeholder="e.g. Personal"
                          onChange={(e) =>
                            patchMobileAccount(index, { accountType: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </EditorRow>
              ))}
            </div>
          )}
        </EditorSubsection>

        <EditorSubsection
          title="Bank accounts"
          description="Branch and routing number can be left blank — a shopper transferring inside the same bank needs neither. An icon is optional: without one the card shows a generic bank mark."
          onAdd={addBankAccount}
          addLabel="Add bank account"
          atCapacity={bankAccounts.length >= MAX_PAYMENT_ACCOUNTS}
          capacityNote={`${MAX_PAYMENT_ACCOUNTS} accounts at most.`}
        >
          {bankAccounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              None yet. Add one if you want to take bank transfers as well.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {bankAccounts.map((account, index) => (
                <EditorRow
                  key={account.id}
                  index={index}
                  count={bankAccounts.length}
                  onMove={(from, to) =>
                    setAccounts({ bankAccounts: moveItem(bankAccounts, from, to) })
                  }
                  onRemove={() => removeBankAccount(index)}
                  error={advanceErrors.bank[index]}
                  removeLabel={`Remove ${account.bankName.trim() || 'this bank account'}`}
                >
                  {(errorId) => (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        {/* First in the row, as on a mobile account: same control,
                            same place, so the two lists stay one pattern. */}
                        <AccountIconField
                          inputId={`bank-icon-${account.id}`}
                          value={account.iconUrl ?? ''}
                          onChange={(iconUrl) => patchBankAccount(index, { iconUrl })}
                          accountLabel={account.bankName.trim() || 'this bank account'}
                        />

                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <Label htmlFor={`bank-name-${account.id}`} className="text-xs">
                            Bank
                          </Label>
                          <Input
                            id={`bank-name-${account.id}`}
                            value={account.bankName}
                            maxLength={120}
                            placeholder="e.g. Dutch-Bangla Bank"
                            aria-invalid={errorId !== undefined}
                            aria-describedby={errorId}
                            onChange={(e) => patchBankAccount(index, { bankName: e.target.value })}
                          />
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <Label htmlFor={`bank-account-name-${account.id}`} className="text-xs">
                            Account name
                          </Label>
                          <Input
                            id={`bank-account-name-${account.id}`}
                            value={account.accountName}
                            maxLength={120}
                            placeholder="As the bank holds it"
                            onChange={(e) =>
                              patchBankAccount(index, { accountName: e.target.value })
                            }
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <Label htmlFor={`bank-account-number-${account.id}`} className="text-xs">
                            Account number
                          </Label>
                          <Input
                            id={`bank-account-number-${account.id}`}
                            value={account.accountNumber}
                            maxLength={60}
                            onChange={(e) =>
                              patchBankAccount(index, { accountNumber: e.target.value })
                            }
                          />
                        </div>

                        <div className="flex w-full flex-col gap-1 sm:w-44">
                          <Label htmlFor={`bank-branch-${account.id}`} className="text-xs">
                            Branch
                          </Label>
                          <Input
                            id={`bank-branch-${account.id}`}
                            value={account.branch}
                            maxLength={120}
                            placeholder="Optional"
                            onChange={(e) => patchBankAccount(index, { branch: e.target.value })}
                          />
                        </div>

                        <div className="flex w-full flex-col gap-1 sm:w-40">
                          <Label htmlFor={`bank-routing-${account.id}`} className="text-xs">
                            Routing number
                          </Label>
                          <Input
                            id={`bank-routing-${account.id}`}
                            value={account.routingNumber}
                            maxLength={40}
                            placeholder="Optional"
                            onChange={(e) =>
                              patchBankAccount(index, { routingNumber: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </EditorRow>
              ))}
            </div>
          )}
        </EditorSubsection>
      </EditorSection>

      <Card className="flex flex-col gap-2 p-4">
        <Label htmlFor="checkout-notice">Notice shown above the Place Order button</Label>
        <Input
          id="checkout-notice"
          value={config.notice}
          maxLength={SETTINGS_LIMITS.checkoutNotice}
          placeholder="e.g. Orders placed after 8pm are delivered next day"
          onChange={(e) => setConfig({ notice: e.target.value })}
        />
        <span className="text-xs text-muted-foreground">
          Leave empty to show nothing. {SETTINGS_LIMITS.checkoutNotice} characters at most.
        </span>
      </Card>

      <EditorActions
        isDirty={draft.isDirty}
        isSaving={updateMutation.isPending}
        onReset={draft.reset}
        onSave={save}
      />

      <UnsavedChangesDialog blocker={blocker} />
    </div>
  )
}
