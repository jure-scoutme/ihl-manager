'use client';
// Zvoki tekme, sintetizirani z Web Audio (brez datotek).
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx) ctx = new C();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(a: AudioContext, dur: number) {
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  return src;
}

// publika: filtriran šum z naraščanjem in pojemanjem
export function cheer(volume = 0.35, dur = 2.2) {
  const a = ac();
  if (!a) return;
  const src = noise(a, dur);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 0.6;
  const g = a.createGain();
  const t = a.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(a.destination);
  src.start(t);
  src.stop(t + dur);
}

// sirena za gol: nizek akord z žagastim valom
export function horn() {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.08);
  g.gain.setValueAtTime(0.18, t + 1.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  lp.connect(g).connect(a.destination);
  for (const f of [110, 138.6, 165]) {
    const o = a.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.connect(lp);
    o.start(t);
    o.stop(t + 2);
  }
}

// sirena za konec tretjine
export function buzzer() {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  o.type = 'square';
  o.frequency.value = 220;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.03);
  g.gain.setValueAtTime(0.08, t + 1.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + 1.3);
}

// razočaranje: kratek, tišji šum
export function groan() {
  cheer(0.12, 1.1);
}
