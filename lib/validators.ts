// Pure, dependency-free validators shared across server actions + tests.

// GSTIN: 2-digit state + 10-char PAN + entity digit + default 'Z' + checksum.
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PHONE_RE = /^[+0-9 ()-]{6,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidGstin(value: string): boolean {
  return GSTIN_RE.test(value.trim().toUpperCase());
}

export function isValidPhone(value: string): boolean {
  return PHONE_RE.test(value.trim());
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
