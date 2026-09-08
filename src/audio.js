import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import { MARSEILLAISE_MIDI_BASE64 } from './marseillaise-midi.js';

// ---------- 音效 (Tone.js 合成,無需音檔) ----------
let audioReady = false;
export function ensureAudio() { if (!audioReady) { Tone.start(); startMusic(); audioReady = true; } }

export function setMuted(muted) { Tone.Destination.mute = muted; }

const shootSynth = new Tone.MembraneSynth({
  pitchDecay: 0.01, octaves: 2,
  envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 }
}).toDestination();
shootSynth.volume.value = -8;
const shootNoise = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.001, decay: 0.06, sustain: 0 }
}).toDestination();
shootNoise.volume.value = -18;
export function playShoot(isPlayer) {
  shootSynth.triggerAttackRelease(isPlayer ? 'C2' : 'A1', 0.1);
  shootNoise.triggerAttackRelease(0.05);
}

const impactSynth = new Tone.MetalSynth({
  frequency: 180, envelope: { attack: 0.001, decay: 0.08, release: 0.02 },
  harmonicity: 3.1, modulationIndex: 16, resonance: 800, octaves: 0.8
}).toDestination();
impactSynth.volume.value = -22;
export function playImpact() { impactSynth.triggerAttackRelease('4n'); }

const hitSynth = new Tone.Synth({
  oscillator: { type: 'square' },
  envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
}).toDestination();
hitSynth.volume.value = -14;
export function playHit() { hitSynth.triggerAttackRelease('E4', 0.08); }

const explosionFilter = new Tone.Filter(500, 'lowpass').toDestination();
const explosionNoise = new Tone.NoiseSynth({
  noise: { type: 'brown' },
  envelope: { attack: 0.005, decay: 0.45, sustain: 0 }
}).connect(explosionFilter);
explosionNoise.volume.value = -4;
export function playExplosion() { explosionNoise.triggerAttackRelease(0.45); }

const gameOverSynth = new Tone.Synth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 0.4 }
}).toDestination();
gameOverSynth.volume.value = -10;
export function playGameOver() {
  const notes = ['A3', 'F3', 'D3', 'A2'];
  const now = Tone.now();
  notes.forEach((n, i) => gameOverSynth.triggerAttackRelease(n, 0.35, now + i * 0.18));
}

const pickupSynth = new Tone.Synth({
  oscillator: { type: 'sine' },
  envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 }
}).toDestination();
pickupSynth.volume.value = -9;
export function playPickup() {
  const now = Tone.now();
  ['C5', 'E5', 'G5'].forEach((n, i) => pickupSynth.triggerAttackRelease(n, 0.1, now + i * 0.07));
}

const alarmSynth = new Tone.Synth({
  oscillator: { type: 'square' },
  envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
}).toDestination();
alarmSynth.volume.value = -11;
export function playMissileLaunch() {
  const now = Tone.now();
  [0, 0.12, 0.24, 0.36].forEach((t, i) => alarmSynth.triggerAttackRelease(i % 2 === 0 ? 'A5' : 'D5', 0.08, now + t));
}

// ---------- 背景音樂播放清單：史詩 / 明亮 / 1812序曲終曲 輪播 ----------
const musicReverb = new Tone.Reverb({ decay: 2, wet: 0.2 }).toDestination();

const padSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 1.4, decay: 0.6, sustain: 0.75, release: 3 }
}).connect(musicReverb);
padSynth.volume.value = -20;

const brassSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'square' },
  envelope: { attack: 0.02, decay: 0.25, sustain: 0.3, release: 0.6 }
}).connect(musicReverb);
brassSynth.volume.value = -16;

const bassSynth = new Tone.Synth({
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.4 }
}).toDestination();
bassSynth.volume.value = -12;

const timpani = new Tone.MembraneSynth({
  pitchDecay: 0.05, octaves: 3,
  envelope: { attack: 0.001, decay: 0.5, sustain: 0 }
}).toDestination();
timpani.volume.value = -8;

const chordSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.005, decay: 0.22, sustain: 0.05, release: 0.15 }
}).connect(musicReverb);
chordSynth.volume.value = -17;

const leadSynth = new Tone.Synth({
  oscillator: { type: 'square' },
  envelope: { attack: 0.005, decay: 0.15, sustain: 0.12, release: 0.15 }
}).connect(musicReverb);
leadSynth.volume.value = -15;

const tickSynth = new Tone.MetalSynth({
  frequency: 900, envelope: { attack: 0.001, decay: 0.04, release: 0.01 },
  harmonicity: 4, modulationIndex: 10, resonance: 2200, octaves: 0.5
}).toDestination();
tickSynth.volume.value = -28;

const cannonSynth = new Tone.MembraneSynth({
  pitchDecay: 0.08, octaves: 5,
  envelope: { attack: 0.001, decay: 0.9, sustain: 0 }
}).toDestination();
cannonSynth.volume.value = -3;

// --- 曲目一：史詩感（D 小調 i-VI-III-VII） ---
const EPIC_PROGRESSION = [
  { pad: ['D3', 'F3', 'A3'], bass: 'D2' },
  { pad: ['A#2', 'D3', 'F3'], bass: 'A#1' },
  { pad: ['F2', 'A2', 'C3'], bass: 'F1' },
  { pad: ['C3', 'E3', 'G3'], bass: 'C2' },
];
const EPIC_THEME = ['D4', null, 'F4', 'A4', null, 'G4', 'F4', null];
let epicChordIdx = 0, epicThemeStep = 0;
const epicChordLoop = new Tone.Loop(time => {
  const c = EPIC_PROGRESSION[epicChordIdx % EPIC_PROGRESSION.length];
  padSynth.triggerAttackRelease(c.pad, '2m', time);
  bassSynth.triggerAttackRelease(c.bass, '2m', time);
  epicChordIdx++;
}, '2m');
const epicTimpaniLoop = new Tone.Loop(time => {
  timpani.triggerAttackRelease('C1', '8n', time, 0.9);
  timpani.triggerAttackRelease('C1', '8n', time + Tone.Time('4n').toSeconds(), 0.5);
}, '2n');
const epicThemeLoop = new Tone.Loop(time => {
  const n = EPIC_THEME[epicThemeStep % EPIC_THEME.length];
  if (n) brassSynth.triggerAttackRelease(n, '4n', time, 0.5);
  epicThemeStep++;
}, '4n');

// --- 曲目二：明亮愉快（C 大調 oom-pah 節奏） ---
const BRIGHT_PROGRESSION = [
  { chord: ['C4', 'E4', 'G4'], bass: 'C2' },
  { chord: ['G3', 'B3', 'D4'], bass: 'G1' },
  { chord: ['A3', 'C4', 'E4'], bass: 'A1' },
  { chord: ['F3', 'A3', 'C4'], bass: 'F1' },
];
const BRIGHT_MELODY = ['C5', 'E5', 'G5', 'E5', 'D5', null, 'G5', 'F5', 'E5', 'G5', 'C6', 'G5', 'A5', 'G5', 'E5', null];
let brightChordIdx = 0, brightMelodyStep = 0;
const brightChordLoop = new Tone.Loop(time => {
  const c = BRIGHT_PROGRESSION[brightChordIdx % BRIGHT_PROGRESSION.length];
  const q = Tone.Time('4n').toSeconds();
  bassSynth.triggerAttackRelease(c.bass, '8n', time);
  bassSynth.triggerAttackRelease(c.bass, '8n', time + q * 2);
  chordSynth.triggerAttackRelease(c.chord, '8n', time + q);
  chordSynth.triggerAttackRelease(c.chord, '8n', time + q * 3);
  brightChordIdx++;
}, '1m');
const brightMelodyLoop = new Tone.Loop(time => {
  const n = BRIGHT_MELODY[brightMelodyStep % BRIGHT_MELODY.length];
  if (n) leadSynth.triggerAttackRelease(n, '8n', time);
  brightMelodyStep++;
}, '8n');
const brightTickLoop = new Tone.Loop(time => {
  tickSynth.triggerAttackRelease('16n', time);
}, '4n');

// --- 曲目三：柴可夫斯基《1812 序曲》—— 真正的馬賽曲 MIDI 演奏 + 禮炮齊鳴 ---
// 直接內嵌 1705_馬賽曲.mid（右手旋律／左手伴奏／合唱襯底三軌）的 base64（見 ./marseillaise-midi.js）
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
const marseillaiseMidi = new Midi(base64ToArrayBuffer(MARSEILLAISE_MIDI_BASE64));

const marseilleRightSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.005, decay: 0.2, sustain: 0.15, release: 0.3 },
}).connect(musicReverb);
marseilleRightSynth.volume.value = -10;

const marseilleLeftSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.3 },
}).toDestination();
marseilleLeftSynth.volume.value = -16;

const marseilleChoirSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'sine' },
  envelope: { attack: 0.3, decay: 0.3, sustain: 0.6, release: 0.8 },
}).connect(musicReverb);
marseilleChoirSynth.volume.value = -14;

const MARSEILLAISE_PARTS = marseillaiseMidi.tracks
  .filter(track => track.notes.length)
  .map(track => {
    const synth = track.name.includes('right') ? marseilleRightSynth
      : track.name.includes('left') ? marseilleLeftSynth
      : marseilleChoirSynth;
    const part = new Tone.Part((time, note) => {
      synth.triggerAttackRelease(note.name, note.duration, time, note.velocity);
    }, track.notes.map(n => [n.time, n]));
    part.loop = true;
    part.loopEnd = marseillaiseMidi.duration;
    return part;
  });

const overtureCannonLoop = new Tone.Loop(time => {
  cannonSynth.triggerAttackRelease('C1', '2n', time, 1);
}, '2m');

const ALL_LOOPS = [
  epicChordLoop, epicTimpaniLoop, epicThemeLoop,
  brightChordLoop, brightMelodyLoop, brightTickLoop,
  ...MARSEILLAISE_PARTS, overtureCannonLoop,
];
function stopAllLoops() { ALL_LOOPS.forEach(l => l.stop()); }

const PLAYLIST = [
  { bpm: 82, play: () => { epicChordLoop.start(); epicTimpaniLoop.start(); epicThemeLoop.start('+2m'); }, duration: 26000 },
  { bpm: 126, play: () => { brightChordLoop.start(); brightTickLoop.start(); brightMelodyLoop.start('+1m'); }, duration: 24000 },
  {
    bpm: 100,
    play: () => {
      MARSEILLAISE_PARTS.forEach(p => p.start());
      overtureCannonLoop.start('+1m');
    },
    duration: Math.ceil(marseillaiseMidi.duration * 1000) + 1500,
  },
];
let trackIdx = -1;
function playNextTrack() {
  stopAllLoops();
  trackIdx = (trackIdx + 1) % PLAYLIST.length;
  const track = PLAYLIST[trackIdx];
  Tone.Transport.bpm.value = track.bpm;
  track.play();
  setTimeout(playNextTrack, track.duration);
}

// 測試階段：先固定只播放 1812 序曲（馬賽進行曲）這首，之後要恢復三首輪播就改回 playNextTrack()
const TESTING_ONLY_TRACK = 2;

let musicStarted = false;
function startMusic() {
  if (musicStarted) return;
  musicStarted = true;
  Tone.Transport.start();
  if (TESTING_ONLY_TRACK !== null) {
    trackIdx = TESTING_ONLY_TRACK;
    const track = PLAYLIST[trackIdx];
    Tone.Transport.bpm.value = track.bpm;
    track.play();
  } else {
    playNextTrack();
  }
}
