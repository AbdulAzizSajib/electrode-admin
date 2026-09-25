/**
 * UI → Integrations → Notifications → Telegram.
 *
 * Two things this card does that no other integration card needs:
 *
 *  1. **It teaches the setup.** The chat ID is typed by hand — the server never
 *     calls `getUpdates` (see the server change's design.md Decision 4) — and a
 *     merchant who has never used a Telegram bot has no way to guess where that
 *     number comes from. The numbered steps are the feature, not decoration.
 *  2. **It sends a test message.** Manual entry has exactly one failure mode: a
 *     typo produces silence. Everywhere else in this feature a delivery failure
 *     is swallowed on purpose, because an alert must never fail the order it
 *     announces — so without this button the first evidence of a wrong chat ID
 *     is a missed order weeks later. The button converts that into an error
 *     message on the page where the mistake was made.
 *
 * The credential inputs themselves are the shared `CredentialForm`, generated
 * from what the server declares. The bot token renders masked because the server
 * marks it `secret`; the chat ID renders readable because it does not. Nothing
 * here knows which is which.
 */
import { Info, Send, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import { useTestIntegration, type IntegrationState } from '@/lib/api/integrations'
import { CredentialForm } from './credential-form'
import { IntegrationCard } from './integration-card'

/**
 * Written for a merchant who has never made a bot, in the order they will do it.
 *
 * Step 3 is the one that looks optional and is not: a bot cannot message anyone
 * who has not spoken to it first, and in a group it only ever receives messages
 * addressed to it by name. "Say hi in the group" produces nothing and looks like
 * a broken integration.
 */
const SETUP_STEPS = [
  'Open Telegram, search for @BotFather and send /newbot. Follow the prompts and copy the token it gives you.',
  'Create a private group for your staff and add your new bot to it.',
  'In that group, send /start@yourbotname — using the bot’s exact name. A plain "hi" will not reach it: bots only see messages addressed to them.',
  'Open https://api.telegram.org/bot<YOUR-TOKEN>/getUpdates in a browser and find "chat":{"id":… — that number is your Chat ID. A group ID starts with a minus sign. Do not share that link; it contains your token.',
  'Paste both values below, save, then press Send test message.',
]

export function TelegramCard({
  integration,
  onDirtyChange,
}: {
  integration: IntegrationState
  onDirtyChange?: (dirty: boolean) => void
}) {
  const test = useTestIntegration()

  const runTest = async () => {
    try {
      const result = await test.mutateAsync(integration.id)
      toast({
        title: 'Test message sent',
        description: result.message,
      })
    } catch (error) {
      /*
       * The server's message verbatim, which is Telegram's own wording where it
       * gave any — "chat not found", "Unauthorized", "bot was blocked by the
       * user". Those three are the common setup mistakes and are
       * indistinguishable from each other without it, so replacing them with
       * "the test failed" would throw away the only useful part of the failure.
       */
      toast({
        title: 'Test message failed',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    }
  }

  return (
    <IntegrationCard integration={integration}>
      <div className="flex flex-col gap-1.5 rounded-md bg-muted/50 p-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Info className="size-3.5" aria-hidden /> Quick Setup
        </span>
        <ol className="ml-5 list-decimal text-xs text-muted-foreground">
          {SETUP_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      {/*
        * Stated on the card, not buried in documentation nobody opens. Order
        * alerts carry the customer's name, phone and address, because the phone
        * number is what makes the alert actionable for a cash-on-delivery shop —
        * but that is customer data leaving for a third party, and the merchant
        * is the one who has to keep the destination chat private. They can only
        * do that if they know it matters.
        */}
      <p className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
        <span>
          Order alerts include the customer&rsquo;s name, phone number and delivery
          address, so staff can call to confirm without opening this panel. Keep
          the destination chat private and staff-only, and remove people from the
          group when they leave.
        </span>
      </p>

      <CredentialForm
        integration={integration}
        title="Bot Credentials"
        description="From @BotFather and @userinfobot — see the steps above."
        saveLabel="Save Telegram Credentials"
        onDirtyChange={onDirtyChange}
      />

      <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
        <span className="text-sm font-medium text-foreground">Check the connection</span>
        <span className="text-xs text-muted-foreground">
          Sends one message to the configured chat and reports what happened.
          Order alerts fail silently by design — this is the only way to find out
          that a Chat ID is wrong before an order depends on it.
        </span>
        <div>
          <Button
            type="button"
            variant="outline"
            /*
             * Disabled until both credentials are stored. The server would
             * refuse with a clear message anyway, but offering a button whose
             * only possible outcome is a refusal wastes the merchant's attempt
             * and makes the card feel broken.
             */
            disabled={!integration.configured || test.isPending}
            onClick={() => void runTest()}
          >
            <Send className="size-4" aria-hidden />
            {test.isPending ? 'Sending…' : 'Send test message'}
          </Button>
        </div>
        {!integration.configured && (
          <span className="text-xs text-muted-foreground">
            Save a bot token and a chat ID first.
          </span>
        )}
      </div>
    </IntegrationCard>
  )
}
