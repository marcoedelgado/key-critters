// Offline check of the pitch detector in index.html.
// Usage: node test/pitch-test.js
'use strict';
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const block = html.match(/\/\* PITCH-BEGIN \*\/([\s\S]*?)\/\* PITCH-END \*\//);
if (!block) throw new Error('PITCH block not found in index.html');
const { detectPitch, freqToPc, createNoteTracker } =
  new Function(block[1] + '\nreturn { detectPitch, freqToPc, createNoteTracker };')();

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);
let failures = 0;
function check(ok, label) {
  console.log((ok ? '  ok   ' : '  FAIL ') + label);
  if (!ok) failures++;
}

// Deterministic noise so runs are repeatable.
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;

// Harmonic-rich tone: amplitudes per harmonic, slight inharmonicity, plus noise.
function tone(freq, sr, n, { harmonics = [1, 0.6, 0.4, 0.25, 0.15, 0.1, 0.07, 0.05], amp = 0.2, noise = 0.004, offset = 0 } = {}) {
  const buf = new Float32Array(n);
  const phases = harmonics.map(() => Math.random() * Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const t = (i + offset) / sr;
    let v = 0;
    harmonics.forEach((a, k) => {
      const h = k + 1;
      v += a * Math.sin(2 * Math.PI * freq * h * (1 + 0.0001 * h * h) * t + phases[k]);
    });
    buf[i] = amp * v / harmonics.reduce((s, a) => s + a, 0) + noise * rand();
  }
  return buf;
}

console.log('\n1) Single frames (fftSize 2048)');
const cases = [
  ['C4', 60, 48000, {}],
  ['E4', 64, 48000, {}],
  ['G3', 55, 48000, {}],
  ['A5', 81, 48000, {}],
  ['C3', 48, 48000, {}],
  ['B4', 71, 48000, {}],
  ['C6', 84, 48000, {}],
  ['C4 weak fundamental', 60, 48000, { harmonics: [0.25, 1, 0.7, 0.4, 0.2] }],
  ['G3 weak fundamental', 55, 48000, { harmonics: [0.2, 1, 0.8, 0.5, 0.3] }],
  ['E4 noisy (SNR ~15 dB)', 64, 48000, { noise: 0.05 }],
  ['A4 at 44.1 kHz', 69, 44100, {}],
  ['F4 quiet (rms ~0.012)', 65, 48000, { amp: 0.03, noise: 0.001 }],
];
for (const [label, midi, sr, opts] of cases) {
  const r = detectPitch(tone(midiFreq(midi), sr, 2048, opts), sr, 0.01);
  const got = r.freq ? NAMES[freqToPc(r.freq)] : '-';
  const cents = r.freq ? 1200 * Math.log2(r.freq / midiFreq(midi)) : NaN;
  const octErr = r.freq ? Math.round(Math.log2(r.freq / midiFreq(midi))) : NaN;
  check(got === NAMES[midi % 12] && octErr === 0,
    `${label.padEnd(24)} -> ${got.padEnd(2)} ${r.freq.toFixed(1).padStart(7)} Hz  ${(cents >= 0 ? '+' : '') + cents.toFixed(1)}c  clarity ${r.clarity.toFixed(3)}`);
}

console.log('\n2) Rejections');
const silence = new Float32Array(2048).map(() => 0.002 * rand());
check(detectPitch(silence, 48000, 0.01).freq === 0, 'quiet noise below sensitivity is rejected');
const loudNoise = new Float32Array(2048).map(() => 0.2 * rand());
const rn = detectPitch(loudNoise, 48000, 0.01);
check(rn.freq === 0, `loud white noise rejected (clarity ${rn.clarity.toFixed(2)})`);

console.log('\n3) Note tracker on a simulated performance (60 frames/s)');
// Builds a continuous signal from note events, then slides a 2048 window with an 800-sample hop.
function perform(events, sr, totalSec) {
  const n = Math.floor(sr * totalSec);
  const sig = new Float32Array(n);
  for (const ev of events) {
    const f = midiFreq(ev.midi), start = Math.floor(ev.t * sr), end = Math.min(n, Math.floor((ev.t + ev.dur) * sr));
    const harm = [1, 0.5, 0.3, 0.2, 0.1];
    for (let i = start; i < n; i++) {
      const t = (i - start) / sr;
      let envAmp = (ev.amp || 0.25) * Math.min(1, t / 0.005) * Math.exp(-t / 0.9);
      if (i >= end) envAmp *= Math.exp(-(i - end) / sr / 0.03); // key released: fast fade
      if (t > 0.01 && envAmp < 1e-5) break;
      let v = 0;
      harm.forEach((a, k) => { v += a * Math.sin(2 * Math.PI * f * (k + 1) * t); });
      sig[i] += envAmp * v / 2.1;
    }
  }
  for (let i = 0; i < n; i++) sig[i] += 0.0015 * rand();
  return sig;
}
// Metronome tick like the app's: 40 ms of band-limited noise (noise x carrier, a cheap band-pass).
function addTicks(sig, sr, bpm, { amp = 0.3, from = 0.2 } = {}) {
  const times = [];
  for (let t = from; t < sig.length / sr - 0.05; t += 60 / bpm) {
    times.push(t);
    const start = Math.floor(t * sr), len = Math.floor(0.04 * sr), carrier = 1700;
    for (let i = 0; i < len; i++) {
      const env = Math.exp(-i / (0.008 * sr));
      sig[start + i] += amp * env * rand() * Math.sin(2 * Math.PI * carrier * i / sr);
    }
  }
  return times;
}
// The app's beat.dirty(): skip frames whose window end is within [tick - 10 ms, tick + 130 ms].
const dirtyRanges = times => times.map(t => [t - 0.01, t + 0.13]);

function runTracker(sig, sr, { mutedRanges = [], skipRanges = [], minRms = 0.01 } = {}) {
  const tr = createNoteTracker(), work = {}, fired = [];
  const hop = Math.round(sr / 60);
  for (let s = 0; s + 2048 <= sig.length; s += hop) {
    const r = detectPitch(sig.subarray(s, s + 2048), sr, minRms, work);
    const pc = r.freq ? freqToPc(r.freq) : -1;
    const tEnd = (s + 2048) / sr;
    const muted = mutedRanges.some(([a, b]) => tEnd >= a && tEnd < b);
    if (skipRanges.some(([a, b]) => tEnd >= a && tEnd <= b)) continue;
    const f = tr.step(pc, r.rms, minRms, muted);
    if (f >= 0) fired.push(NAMES[f]);
  }
  return fired.join(' ');
}

// "C C C C D E": first C's with full release, then a fast repeat (no silence, re-arm by attack).
const sr = 48000;
const perf1 = perform([
  { midi: 60, t: 0.1, dur: 0.35 },
  { midi: 60, t: 0.7, dur: 0.35 },
  { midi: 60, t: 1.3, dur: 0.6 },
  { midi: 60, t: 1.95, dur: 0.4 },  // re-struck while the previous C still rings
  { midi: 62, t: 2.6, dur: 0.4 },
  { midi: 52, t: 3.2, dur: 0.6 },   // E3 - wrong octave, should still be E
], sr, 4.2);
const got1 = runTracker(perf1, sr);
check(got1 === 'C C C C D E', `repeated notes counted once each: "${got1}"`);

// True legato re-strike: the first C is still held (and ringing at ~50%) when it's struck again,
// so only the attack detector can re-arm.
const perfL = perform([
  { midi: 60, t: 0.1, dur: 2.0, amp: 0.15 },
  { midi: 60, t: 0.7, dur: 0.8, amp: 0.3 },
  { midi: 64, t: 2.4, dur: 0.6 },
], sr, 3.2);
const gotL = runTracker(perfL, sr);
check(gotL === 'C C E', `legato re-strike re-arms via attack: "${gotL}"`);

// Held note must fire exactly once.
const got2 = runTracker(perform([{ midi: 67, t: 0.1, dur: 2.5 }], sr, 3), sr);
check(got2 === 'G', `long held G fires once: "${got2}"`);

// App plays E (muted for its 1.2 s + 0.5 s), then the child plays E: only the child's E fires.
const perf3 = perform([
  { midi: 64, t: 0.1, dur: 1.2, amp: 0.3 },   // app's own sound
  { midi: 64, t: 2.2, dur: 0.5 },             // child
], sr, 3.2);
const got3 = runTracker(perf3, sr, { mutedRanges: [[0.1, 0.1 + 1.2 + 0.5]] });
check(got3 === 'E', `own sound ignored, child's E heard: "${got3}"`);

// Same, but the app's sound is still slightly audible after the mute window ends.
const perf4 = perform([{ midi: 72, t: 0.1, dur: 3, amp: 0.4 }], sr, 3);
const got4 = runTracker(perf4, sr, { mutedRanges: [[0.1, 1.0]] });
check(got4 === '', `tail of own sound after mute is not heard: "${got4}"`);

console.log('\n4) Metronome ticks');
for (const bpm of [60, 80, 100]) {
  const quiet = new Float32Array(sr * 4).map(() => 0.0015 * rand());
  addTicks(quiet, sr, bpm);
  const got = runTracker(quiet, sr);
  check(got === '', `${bpm} bpm ticks alone (not skipped) never fire a note: "${got}"`);
}
for (const bpm of [60, 100]) {
  const held = perform([{ midi: 67, t: 0.1, dur: 3.5, amp: 0.25 }], sr, 4);
  const times = addTicks(held, sr, bpm, { from: 0.35 });
  const got = runTracker(held, sr, { skipRanges: dirtyRanges(times) });
  check(got === 'G', `held G under ${bpm} bpm ticks fires once (ticks skipped): "${got}"`);
}
{
  // Melody under a 100 bpm beat with the app's skip windows: every note still counted.
  const perf = perform([
    { midi: 64, t: 0.3, dur: 0.45 }, { midi: 62, t: 0.9, dur: 0.45 }, { midi: 60, t: 1.5, dur: 0.45 },
    { midi: 60, t: 2.1, dur: 0.45 }, { midi: 60, t: 2.7, dur: 0.45 },
  ], sr, 3.6);
  const times = addTicks(perf, sr, 100, { from: 0.3 }); // ticks land right on the note onsets
  const got = runTracker(perf, sr, { skipRanges: dirtyRanges(times) });
  check(got === 'E D C C C', `"E D C C C" played on the beat is heard: "${got}"`);
}

console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
process.exit(failures ? 1 : 0);
