// Minimal iCalendar (.ics) builder for bookings — no dependency. Produces a
// single-VEVENT VCALENDAR a buyer can import into Google/Apple/Outlook. Pure;
// safe to import on server (route handlers). Times are UTC instants (ISO in →
// UTC basic format out), so calendars render them in the viewer's own zone.

function toIcsUtc(iso: string): string {
  // 2026-06-12T10:00:00.000Z → 20260612T100000Z
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeText(s: string): string {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export interface BookingIcsInput {
  uid: string; // stable per booking, e.g. `${id}@invoxai.io`
  startIso: string;
  endIso: string;
  title: string;
  description?: string | null;
  location?: string | null;
  organizerEmail?: string | null;
  attendeeEmail?: string | null;
  stampIso?: string; // DTSTAMP; defaults to now
}

export function buildBookingIcs(input: BookingIcsInput): string {
  const stamp = toIcsUtc(input.stampIso ?? new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//InvoxAI//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toIcsUtc(input.startIso)}`,
    `DTEND:${toIcsUtc(input.endIso)}`,
    `SUMMARY:${escapeText(input.title)}`,
  ];
  if (input.description) lines.push(`DESCRIPTION:${escapeText(input.description)}`);
  if (input.location) lines.push(`LOCATION:${escapeText(input.location)}`);
  if (input.organizerEmail) {
    lines.push(`ORGANIZER:mailto:${input.organizerEmail}`);
  }
  if (input.attendeeEmail) {
    lines.push(
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED:mailto:${input.attendeeEmail}`,
    );
  }
  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}
