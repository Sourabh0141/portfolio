const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
/** A run of 8 or more digits, allowing the spaces, dots, dashes and brackets used in phone numbers. */
const LONG_NUMBER = /[+(]{0,2}\d(?:[\s().-]*\d){7,}/g;

const MAX_LOGGED_CHARS = 600;

/**
 * Prepares a visitor's question for the log. Email addresses and long numbers (phone, card,
 * identity numbers) are replaced before the text leaves the request, so they are never stored.
 */
export function redactForLog(text: string): string {
  return text
    .replace(EMAIL, '[email]')
    .replace(LONG_NUMBER, '[number]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LOGGED_CHARS);
}
