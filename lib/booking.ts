// Booking helpers — slot generation + formatting. Times are authored as
// IST (Asia/Kolkata) wall-clock and stored/compared as UTC instants. Pure
// functions, safe to import on client + server. (TZ is fixed to IST for v1.)

export const IST_OFFSET_MIN = 330;

export interface AvailabilityWindow {
  weekday: number; // 0=Sun … 6=Sat (IST)
  start_min: number; // minutes from midnight IST
  end_min: number;
}

export interface Slot {
  /** UTC ISO instant of the slot start (what we store on bookings.start_at). */
  startIso: string;
  /** Human label in IST, e.g. "Mon, 12 Jun · 3:30 PM". */
  label: string;
}

function istPartsOf(instant: number): {
  y: number;
  m: number;
  d: number;
  weekday: number;
} {
  const ist = new Date(instant + IST_OFFSET_MIN * 60_000);
  return {
    y: ist.getUTCFullYear(),
    m: ist.getUTCMonth(),
    d: ist.getUTCDate(),
    weekday: ist.getUTCDay(),
  };
}

/** IST wall-clock (date + minutes-from-midnight) → UTC instant (ms). */
function istWallToUtc(
  y: number,
  m: number,
  d: number,
  minutes: number,
): number {
  return Date.UTC(y, m, d, 0, 0) + minutes * 60_000 - IST_OFFSET_MIN * 60_000;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatSlotLabel(startIso: string): string {
  const instant = Date.parse(startIso);
  const ist = new Date(instant + IST_OFFSET_MIN * 60_000);
  let h = ist.getUTCHours();
  const min = ist.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const mm = String(min).padStart(2, "0");
  return `${DAYS[ist.getUTCDay()]}, ${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]} · ${h}:${mm} ${ampm}`;
}

/**
 * Generate bookable slots for the next `days` days from `now`, stepping each
 * availability window by (duration + buffer). Skips past slots and any already
 * in `bookedIsos`.
 */
export function generateSlots(args: {
  availability: AvailabilityWindow[];
  durationMin: number;
  bufferMin: number;
  bookedIsos: Set<string>;
  now: number;
  days?: number;
  maxSlots?: number;
}): Slot[] {
  const {
    availability,
    durationMin,
    bufferMin,
    bookedIsos,
    now,
    days = 14,
    maxSlots = 200,
  } = args;
  if (durationMin <= 0 || availability.length === 0) return [];
  const step = durationMin + Math.max(0, bufferMin);
  const slots: Slot[] = [];

  for (let i = 0; i < days && slots.length < maxSlots; i++) {
    const dayInstant = now + i * 86_400_000;
    const { y, m, d, weekday } = istPartsOf(dayInstant);
    const windows = availability.filter((w) => w.weekday === weekday);
    for (const w of windows) {
      for (let t = w.start_min; t + durationMin <= w.end_min; t += step) {
        const startUtc = istWallToUtc(y, m, d, t);
        if (startUtc <= now) continue; // past
        const startIso = new Date(startUtc).toISOString();
        if (bookedIsos.has(startIso)) continue;
        slots.push({ startIso, label: formatSlotLabel(startIso) });
        if (slots.length >= maxSlots) break;
      }
    }
  }
  slots.sort((a, b) => a.startIso.localeCompare(b.startIso));
  return slots;
}

/** "9:00 AM" for a minutes-from-midnight value (IST authoring helper). */
export function minToLabel(min: number): string {
  let h = Math.floor(min / 60);
  const mm = String(min % 60).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${mm} ${ampm}`;
}
