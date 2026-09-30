/**
 * Escape user input for a PostgREST `.like()` / `.ilike()` filter so it
 * matches literally (case-insensitive for ilike) instead of acting as a
 * pattern. Escapes the LIKE metacharacters `\`, `%` and `_` with the
 * default backslash escape. PostgREST additionally rewrites `*` to `%`,
 * so `*` is escaped too — it then becomes the literal `\%`, which can
 * never act as a wildcard.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_*]/g, (ch) => `\\${ch}`);
}
