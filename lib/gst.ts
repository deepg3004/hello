// GST / GSTIN helpers — pure functions + constants. Safe to import on the
// client. The Indian GST regime details encoded here:
//   - GSTIN format: [SS][PPPPPCCCCC][E][Z][C] (15 chars)
//   - First 2 chars = state code (decimal, 0-padded)
//   - FY runs April → March; we use the "YYMM" pair e.g. 2526 for 2025-26
//   - Intra-state sale: CGST + SGST each = rate/2
//   - Inter-state sale: IGST = full rate

export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][Z][0-9A-Z]$/;

export function isValidGSTIN(input: string | null | undefined): boolean {
  if (!input) return false;
  return GSTIN_REGEX.test(input.trim().toUpperCase());
}

/** Extract the state code from a GSTIN (first 2 chars). */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!isValidGSTIN(gstin)) return null;
  return (gstin as string).slice(0, 2);
}

export const ALLOWED_GST_RATES = [0, 5, 12, 18, 28] as const;
export type GstRate = (typeof ALLOWED_GST_RATES)[number];

export function isAllowedRate(rate: unknown): rate is GstRate {
  return (
    typeof rate === "number" &&
    (ALLOWED_GST_RATES as readonly number[]).includes(rate)
  );
}

// ── State code → state name (used in invoice + place-of-supply text) ───────
export const STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman & Diu",
  "26": "Dadra & Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Before Bifurcation)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

export function stateNameFromCode(code: string | null | undefined): string {
  if (!code) return "—";
  return STATE_CODES[code] ?? "—";
}

// ── Tax split ──────────────────────────────────────────────────────────────

export interface TaxSplit {
  taxable_amount: number;
  rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  total_amount: number;
  /** intra | inter | none */
  kind: "intra" | "inter" | "none";
}

export interface TaxSplitInput {
  /** Total the buyer is paying (gross). */
  gross_amount: number;
  /** Applicable GST rate (0/5/12/18/28). */
  rate: number;
  seller_state_code: string | null | undefined;
  buyer_state_code: string | null | undefined;
  /**
   * Whether the gross_amount is inclusive of GST. InvoxAI sellers price
   * inclusive of GST by convention — we back-compute the taxable amount.
   */
  inclusive?: boolean;
}

/**
 * Compute the CGST/SGST/IGST split for an order.
 *
 *   - Same state           → CGST + SGST (rate/2 each)
 *   - Different state /
 *     no buyer state       → IGST (full rate)
 *   - Rate = 0 (exempt)    → no tax, "Bill of Supply"
 */
export function computeTaxSplit(input: TaxSplitInput): TaxSplit {
  const rate = Math.max(0, input.rate);
  const inclusive = input.inclusive ?? true;
  const gross = Math.max(0, Number(input.gross_amount ?? 0));
  if (rate === 0 || gross === 0) {
    return {
      taxable_amount: round2(gross),
      rate: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      total_tax: 0,
      total_amount: round2(gross),
      kind: "none",
    };
  }

  const taxable = inclusive ? gross / (1 + rate / 100) : gross;
  const totalTax = inclusive ? gross - taxable : taxable * (rate / 100);
  const seller = input.seller_state_code?.trim() ?? null;
  const buyer = input.buyer_state_code?.trim() ?? null;
  const intra = !!seller && !!buyer && seller === buyer;

  return {
    taxable_amount: round2(taxable),
    rate,
    cgst: intra ? round2(totalTax / 2) : 0,
    sgst: intra ? round2(totalTax / 2) : 0,
    igst: intra ? 0 : round2(totalTax),
    total_tax: round2(totalTax),
    total_amount: round2(taxable + totalTax),
    kind: intra ? "intra" : "inter",
  };
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

// ── Financial year + numbering ────────────────────────────────────────────

/**
 * Indian financial year shortcode for a given date.
 *   2025-04-01 → "2526"
 *   2026-03-31 → "2526"
 *   2026-04-01 → "2627"
 */
export function financialYearCode(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1; // 1..12
  const startYear = m >= 4 ? y : y - 1;
  const a = String(startYear % 100).padStart(2, "0");
  const b = String((startYear + 1) % 100).padStart(2, "0");
  return `${a}${b}`;
}

/** Two-letter initials from a name (or fallback). */
export function sellerInitials(name: string | null | undefined): string {
  const fallback = "IVX";
  if (!name) return fallback;
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => /[A-Za-z]/.test(p));
  if (parts.length === 0) return fallback;
  const letters = parts.slice(0, 3).map((p) => p[0]!.toUpperCase());
  return letters.join("").padEnd(2, "X");
}

/** Build the displayed invoice number from its component parts. */
export function formatInvoiceNumber(
  initials: string,
  fy: string,
  sequenceNum: number,
): string {
  return `INV-${initials}-${fy}-${String(sequenceNum).padStart(4, "0")}`;
}

// ── Amount in words (Indian numbering system) ──────────────────────────────

const ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigit(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const t = Math.floor(n / 10);
  const r = n % 10;
  return r === 0 ? TENS[t]! : `${TENS[t]} ${ONES[r]}`;
}

function threeDigit(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const head = h > 0 ? `${ONES[h]} Hundred` : "";
  const tail = r > 0 ? twoDigit(r) : "";
  return [head, tail].filter(Boolean).join(" ");
}

export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount)) return "Zero Rupees";
  const sign = amount < 0 ? "Minus " : "";
  const total = Math.abs(amount);
  const rupees = Math.floor(total);
  const paise = Math.round((total - rupees) * 100);

  function rupeesInWords(n: number): string {
    if (n === 0) return "Zero";
    const crore = Math.floor(n / 10000000);
    n = n % 10000000;
    const lakh = Math.floor(n / 100000);
    n = n % 100000;
    const thousand = Math.floor(n / 1000);
    n = n % 1000;
    const hundreds = n;
    const parts: string[] = [];
    if (crore) parts.push(`${threeDigit(crore)} Crore`);
    if (lakh) parts.push(`${threeDigit(lakh)} Lakh`);
    if (thousand) parts.push(`${threeDigit(thousand)} Thousand`);
    if (hundreds) parts.push(threeDigit(hundreds));
    return parts.join(" ").trim();
  }

  const head = `${sign}${rupeesInWords(rupees)} Rupees`;
  const paiseTxt = paise > 0 ? ` and ${twoDigit(paise)} Paise` : "";
  return `${head}${paiseTxt} Only`.replace(/\s+/g, " ").trim();
}
