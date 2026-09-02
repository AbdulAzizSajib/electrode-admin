/**
 * Turns a human-readable name into a lowercase, hyphen-joined slug.
 *
 * Accents are stripped via NFD decomposition so an accented name and its plain
 * ASCII spelling land on the same slug, rather than on one the server would reject.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
