/** Turns whatever a rejected mutation threw into something a merchant can read. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong'
}
