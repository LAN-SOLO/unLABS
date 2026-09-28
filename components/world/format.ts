import { intlLocale } from "@/lib/i18n";

/**
 * Locale-aware number with a fixed number of decimals:
 * en "1,000.5" · de "1.000,5".
 */
export function fmtNum(value: number, digits: number): string {
  return new Intl.NumberFormat(intlLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * @deprecated Always German ("1,5"). Use `fmtNum` when converting a file to
 * English source strings; kept so not-yet-converted files keep their output.
 */
export function deNum(value: number, digits: number): string {
  return value.toFixed(digits).replace(".", ",");
}
