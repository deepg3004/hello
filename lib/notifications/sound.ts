// Client-only. A synthesized "cha-ching" — a bright ascending two-tone chime
// reminiscent of a cash register / the WooCommerce new-order sound. We
// synthesize with the Web Audio API instead of shipping an mp3 so there's no
// asset to host, no copyright concern, and zero network latency on play.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
  }
  return ctx;
}

/**
 * Browsers suspend new AudioContexts until a user gesture. Call this once from
 * a real gesture (pointerdown/keydown) so the very first notification can play
 * without being blocked.
 */
export function unlockAudio(): void {
  const ac = getCtx();
  if (ac && ac.state === "suspended") void ac.resume().catch(() => {});
}

/** One bell-ish note: sine fundamental + a quieter octave, fast exp decay. */
function ding(ac: AudioContext, freq: number, at: number, gainPeak: number) {
  const out = ac.createGain();
  out.gain.setValueAtTime(0, at);
  out.gain.linearRampToValueAtTime(gainPeak, at + 0.008);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 0.38);
  out.connect(ac.destination);

  const osc = ac.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  osc.connect(out);

  const harm = ac.createOscillator();
  harm.type = "sine";
  harm.frequency.value = freq * 2;
  const harmGain = ac.createGain();
  harmGain.gain.value = 0.4;
  harm.connect(harmGain);
  harmGain.connect(out);

  osc.start(at);
  harm.start(at);
  osc.stop(at + 0.42);
  harm.stop(at + 0.42);
}

export function playOrderSound(): void {
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume().catch(() => {});
  const now = ac.currentTime + 0.02;
  // E6 → A6: a quick, satisfying "cha-ching".
  ding(ac, 1318.51, now, 0.18);
  ding(ac, 1760.0, now + 0.09, 0.2);
}
