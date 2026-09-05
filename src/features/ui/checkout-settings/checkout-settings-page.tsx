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
import {
  EditorActions,
  UnsavedChangesDialog,
} from '@/features/ui/components/settings-editor'
import {
  useSettingsDraft,
  useUnsavedChangesGuard,
} from '@/features/ui/components/settings-editor-utils'
import { formatCurrency } from '@/lib/utils/format'
import {
  useStoreSettings,
  useUpdateStoreSettings,
  CHECKOUT_FIELD_KEYS,
  CHECKOUT_FIELD_LABELS,
  DEFAULT_CHECKOUT_CONFIG,
  LOCKED_CHECKOUT_FIELDS,
  SETTINGS_LIMITS,
  type CheckoutConfig,
  type CheckoutFieldKey,
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
  "Controls what the website's checkout page asks customers for, and what an order has to be worth to earn free delivery."

/** Explains each locked row, shown beside its padlock. */
const LOCK_REASON: Partial<Record<CheckoutFieldKey, string>> = {
  phone:
    'Order tracking and the cash-on-delivery limit are both keyed on the mobile number, so it cannot be hidden or made optional.',
}

/**
 * Turning City off is legitimate — a flat-rate merchant has no use for it — but
 * it changes how delivery is priced, and that is worth saying at the moment of
 * the decision rather than leaving it to be discovered through refused orders.
 */
const CITY_WARNING =
  'Delivery is priced by region using the city. Without it, orders fall back to your country-level rule, then to your catch-all rule — and if you have neither, deliveries will be refused.'

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

  const save = async () => {
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
