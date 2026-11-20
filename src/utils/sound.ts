let audioCtx: AudioContext | null = null;
let isMuted = false;

// Active Aviator authentic aircraft turbine + aerodynamic climb nodes
let aviatorLoopTimer: number | null = null;
let aviatorMultLevel = 1.0;
let flightNoiseSrc: AudioBufferSourceNode | null = null;
let flightFilter: BiquadFilterNode | null = null;
let flightGain: GainNode | null = null;
let flightEngineOsc: OscillatorNode | null = null;
let flightEngineGain: GainNode | null = null;
let flightSubOsc: OscillatorNode | null = null;

// Active Mines Pro continuous rhythmic suspense tune timer
let minesProTuneTimer: number | null = null;
let minesProTuneStep = 0;

// Active Chicken Road continuous upbeat arcade tune timer
let chickenRoadTuneTimer: number | null = null;
let chickenRoadTuneStep = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || isMuted) return null;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function setSoundMuted(muted: boolean) {
  isMuted = muted;
  if (muted) {
    stopAviatorFlightLoop();
    stopMinesProTune();
    stopChickenRoadTune();
  }
}

export function getSoundMuted(): boolean {
  return isMuted;
}

/**
 * Clean soft tick during the final 5-second WinGo countdown (5..1).
 */
export function playCountdownTick(secondLeft: number) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(secondLeft === 1 ? 880 : 660, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  } catch {
    // Ignore autoplay restrictions
  }
}

/**
 * Crisp bell ring sound played right when a WinGo round result reveals.
 */
export function playResultRing() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const tones = [
      { freq: 1046.5, delay: 0, dur: 0.45, vol: 0.14 },
      { freq: 1567.98, delay: 0.04, dur: 0.5, vol: 0.1 },
      { freq: 2093.0, delay: 0.08, dur: 0.55, vol: 0.07 },
    ];
    tones.forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(t.freq, now + t.delay);
      gain.gain.setValueAtTime(0.001, now + t.delay);
      gain.gain.exponentialRampToValueAtTime(t.vol, now + t.delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t.delay + t.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t.delay);
      osc.stop(now + t.delay + t.dur + 0.02);
    });
  } catch {
    // Ignore
  }
}

export function playSirenBeep(secondLeft: number) {
  playCountdownTick(secondLeft);
}

/**
 * Tactile casino chip / bet-lock confirmation sound.
 */
export function playBetConfirm() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(580, now);
    osc1.frequency.exponentialRampToValueAtTime(920, now + 0.065);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1160, now + 0.03);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(now);
    osc2.start(now + 0.03);
    osc1.stop(now + 0.12);
    osc2.stop(now + 0.12);
  } catch {
    // Ignore
  }
}

export function playWinChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.001, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.13, now + idx * 0.055 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.3);
    });
  } catch {
    // Ignore
  }
}

export function playLossTone() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // Ignore
  }
}

/**
 * Authentic Spribe Aviator takeoff sweep: clean airy jet whoosh + ascending harmonic chime.
 */
export function playAviatorTakeoff() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.55);
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.setValueAtTime(340, now);
    nFilter.frequency.exponentialRampToValueAtTime(1600, now + 0.45);
    nFilter.Q.value = 1.4;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.001, now);
    nGain.gain.exponentialRampToValueAtTime(0.08, now + 0.12);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.54);

    [261.63, 392.0, 523.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.001, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.06, now + idx * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.32);
    });
  } catch {
    // Ignore
  }
}

/**
 * Authentic betting-app Aviator aircraft propulsion + rising jet airflow climb (zero musical chords).
 */
export function startAviatorFlightLoop(initialMultiplier = 1.0) {
  if (typeof window === 'undefined' || isMuted || aviatorLoopTimer !== null) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  aviatorMultLevel = Math.max(1.0, initialMultiplier);

  try {
    const now = ctx.currentTime;
    const climbRatio = Math.min(2.2, 1 + Math.log10(Math.max(1, aviatorMultLevel)) * 0.75);

    // 1. Filtered turbine rushing air whoosh
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 2.5);
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(380 * climbRatio, now);
    filter.Q.value = 1.1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    flightNoiseSrc = noise;
    flightFilter = filter;
    flightGain = gain;

    // 2. Smooth twin-prop / jet engine hum rising cleanly with multiplier
    const engine = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const engFilter = ctx.createBiquadFilter();
    const engGain = ctx.createGain();

    engine.type = 'triangle';
    engine.frequency.setValueAtTime(86 * climbRatio, now);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(43 * climbRatio, now);

    engFilter.type = 'lowpass';
    engFilter.frequency.setValueAtTime(320 * climbRatio, now);

    engGain.gain.setValueAtTime(0.001, now);
    engGain.gain.exponentialRampToValueAtTime(0.048, now + 0.22);

    engine.connect(engFilter);
    sub.connect(engFilter);
    engFilter.connect(engGain);
    engGain.connect(ctx.destination);

    engine.start(now);
    sub.start(now);

    flightEngineOsc = engine;
    flightSubOsc = sub;
    flightEngineGain = engGain;
  } catch {
    // Ignore
  }

  // Soft cockpit telemetry tick synced with climb speed
  const playBeaconTick = () => {
    const activeCtx = getAudioContext();
    if (!activeCtx || isMuted) return;
    try {
      const now = activeCtx.currentTime;
      const tick = activeCtx.createOscillator();
      const tGain = activeCtx.createGain();
      const boost = Math.min(2.0, 1 + Math.log10(Math.max(1, aviatorMultLevel)) * 0.55);
      tick.type = 'sine';
      tick.frequency.setValueAtTime(520 * boost, now);
      tGain.gain.setValueAtTime(0.001, now);
      tGain.gain.exponentialRampToValueAtTime(0.022, now + 0.008);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      tick.connect(tGain);
      tGain.connect(activeCtx.destination);
      tick.start(now);
      tick.stop(now + 0.07);
    } catch {
      // Ignore
    }
  };

  playBeaconTick();
  aviatorLoopTimer = window.setInterval(playBeaconTick, 460);
}

export function updateAviatorFlightPitch(multiplier: number) {
  aviatorMultLevel = Math.max(1.0, multiplier);
  if (!audioCtx || isMuted) return;
  try {
    const now = audioCtx.currentTime;
    const climbRatio = Math.min(2.3, 1 + Math.log10(Math.max(1, aviatorMultLevel)) * 0.8);
    if (flightFilter) {
      flightFilter.frequency.setTargetAtTime(380 * climbRatio, now, 0.08);
    }
    if (flightEngineOsc) {
      flightEngineOsc.frequency.setTargetAtTime(86 * climbRatio, now, 0.08);
    }
    if (flightSubOsc) {
      flightSubOsc.frequency.setTargetAtTime(43 * climbRatio, now, 0.08);
    }
  } catch {
    // Ignore
  }
}

export function stopAviatorFlightLoop() {
  if (aviatorLoopTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(aviatorLoopTimer);
    aviatorLoopTimer = null;
  }
  try {
    if (flightGain && audioCtx) {
      flightGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.03);
    }
    if (flightEngineGain && audioCtx) {
      flightEngineGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.03);
    }
    const n1 = flightNoiseSrc;
    const e1 = flightEngineOsc;
    const s1 = flightSubOsc;
    setTimeout(() => {
      try {
        n1?.stop();
        n1?.disconnect();
        e1?.stop();
        e1?.disconnect();
        s1?.stop();
        s1?.disconnect();
      } catch {
        // Ignore
      }
    }, 70);
  } catch {
    // Ignore
  }
  flightNoiseSrc = null;
  flightFilter = null;
  flightGain = null;
  flightEngineOsc = null;
  flightSubOsc = null;
  flightEngineGain = null;
}

/**
 * Authentic Aviator "Flew Away / Crash" sound:
 * rapid jet Doppler zip-away + deep punchy crash boom.
 */
export function playAviatorCrash() {
  stopAviatorFlightLoop();
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1. Jet fly-away Doppler pitch drop
    const whistle = ctx.createOscillator();
    const whistleGain = ctx.createGain();
    whistle.type = 'triangle';
    whistle.frequency.setValueAtTime(780, now);
    whistle.frequency.exponentialRampToValueAtTime(145, now + 0.42);
    whistleGain.gain.setValueAtTime(0.001, now);
    whistleGain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    whistle.connect(whistleGain);
    whistleGain.connect(ctx.destination);
    whistle.start(now);
    whistle.stop(now + 0.46);

    // 2. High-speed air rush swoosh
    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.48);
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = 'bandpass';
    nFilter.frequency.setValueAtTime(1650, now);
    nFilter.frequency.exponentialRampToValueAtTime(180, now + 0.42);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.16, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.48);

    // 3. Punchy low-end crash boom thump
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(165, now + 0.04);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.38);
    subGain.gain.setValueAtTime(0.3, now + 0.04);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now + 0.04);
    sub.stop(now + 0.42);
  } catch {
    // Ignore
  }
}

/**
 * Instant crisp cashout bell & coin chime.
 */
export function playAviatorCashout() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    [1046.5, 1318.51, 1567.98, 2093.0].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      gain.gain.setValueAtTime(0.001, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.14, now + i * 0.04 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.26);
    });
  } catch {
    // Ignore
  }
}

/**
 * Crystalline Mines gem / star reveal chime — climbs slightly in pitch with combo count.
 */
export function playMinesGem(combo = 1) {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const ratio = Math.min(1.85, Math.pow(1.06, Math.max(0, combo - 1)));
    [660 * ratio, 990 * ratio].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.001, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.13, now + idx * 0.04 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.24);
    });
  } catch {
    // Ignore
  }
}

/**
 * Bright star-unlock sparkle sound for Mines Pro star flips.
 */
export function playStarOpen(starCount = 1) {
  playMinesGem(starCount);
}

/**
 * Continuous upbeat rhythmic suspense tune for Mines Pro:
 * plays from round start until one of the 3 mines blasts.
 */
export function startMinesProTune() {
  if (typeof window === 'undefined' || isMuted || minesProTuneTimer !== null) return;
  const melody = [392.0, 493.88, 587.33, 783.99, 587.33, 493.88, 440.0, 659.25];
  const bass = [130.81, 130.81, 164.81, 164.81, 146.83, 146.83, 196.0, 196.0];
  minesProTuneStep = 0;

  const playNote = () => {
    const ctx = getAudioContext();
    if (!ctx || isMuted) return;
    try {
      const now = ctx.currentTime;
      const idx = minesProTuneStep % melody.length;
      minesProTuneStep += 1;

      const lead = ctx.createOscillator();
      const leadGain = ctx.createGain();
      lead.type = 'triangle';
      lead.frequency.setValueAtTime(melody[idx], now);
      leadGain.gain.setValueAtTime(0.001, now);
      leadGain.gain.exponentialRampToValueAtTime(0.065, now + 0.015);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      lead.connect(leadGain);
      leadGain.connect(ctx.destination);
      lead.start(now);
      lead.stop(now + 0.25);

      const b = ctx.createOscillator();
      const bGain = ctx.createGain();
      b.type = 'sine';
      b.frequency.setValueAtTime(bass[idx], now);
      bGain.gain.setValueAtTime(0.001, now);
      bGain.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      b.connect(bGain);
      bGain.connect(ctx.destination);
      b.start(now);
      b.stop(now + 0.24);
    } catch {
      // Ignore
    }
  };

  playNote();
  minesProTuneTimer = window.setInterval(playNote, 260);
}

export function stopMinesProTune() {
  if (minesProTuneTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(minesProTuneTimer);
    minesProTuneTimer = null;
  }
}

/**
 * Mines bomb explosion sound: punchy sub-bass boom + filtered blast crackle.
 */
export function playMinesBoom() {
  stopAviatorFlightLoop();
  stopMinesProTune();
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(ctx, 0.72);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1650, now);
    filter.frequency.exponentialRampToValueAtTime(85, now + 0.65);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.28, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.7);

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(155, now);
    sub.frequency.exponentialRampToValueAtTime(26, now + 0.42);
    subGain.gain.setValueAtTime(0.3, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.48);
  } catch {
    // Ignore
  }
}

/**
 * Tactile dice rattle + landing click.
 */
export function playDiceShake() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    [0, 0.045, 0.095].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420 + idx * 140, now + offset);
      gain.gain.setValueAtTime(0.08, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.045);
    });
  } catch {
    // Ignore
  }
}

export function playChickenStep(lane = 1) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = 440 + Math.min(7, lane) * 55;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.45, now + 0.09);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  } catch {
    // Ignore
  }
}

export function playChickenCrash() {
  playMinesBoom();
}

export function playVertexLaunch() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.24);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.27);
  } catch {
    // Ignore
  }
}

export function playCrystalShatter(won = true) {
  if (won) {
    playAviatorCashout();
  } else {
    playLossTone();
  }
}

export function playTowerDrop(floor = 1) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    // Crisp floor lock thud + rising chime
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(160, now);
    thud.frequency.exponentialRampToValueAtTime(55, now + 0.09);
    thudGain.gain.setValueAtTime(0.18, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.12);

    const chime = ctx.createOscillator();
    const chimeGain = ctx.createGain();
    chime.type = 'triangle';
    const note = 520 + Math.min(12, floor) * 48;
    chime.frequency.setValueAtTime(note, now + 0.05);
    chime.frequency.exponentialRampToValueAtTime(note * 1.25, now + 0.16);
    chimeGain.gain.setValueAtTime(0.11, now + 0.05);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    chime.connect(chimeGain);
    chimeGain.connect(ctx.destination);
    chime.start(now + 0.05);
    chime.stop(now + 0.2);
  } catch {
    // Ignore
  }
}

export function playTowerCrash() {
  playMinesBoom();
}

export function startChickenRoadTune() {
  stopChickenRoadTune();
  if (typeof window === 'undefined' || isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880.0, 783.99];
  const bass = [130.81, 130.81, 196.0, 196.0, 146.83, 146.83, 174.61, 196.0];
  chickenRoadTuneStep = 0;

  const playNote = () => {
    const activeCtx = getAudioContext();
    if (!activeCtx || isMuted) return;
    try {
      const now = activeCtx.currentTime;
      const idx = chickenRoadTuneStep % melody.length;
      chickenRoadTuneStep += 1;

      const lead = activeCtx.createOscillator();
      const leadGain = activeCtx.createGain();
      lead.type = 'square';
      lead.frequency.setValueAtTime(melody[idx], now);
      leadGain.gain.setValueAtTime(0.001, now);
      leadGain.gain.exponentialRampToValueAtTime(0.04, now + 0.015);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      lead.connect(leadGain);
      leadGain.connect(activeCtx.destination);
      lead.start(now);
      lead.stop(now + 0.18);

      const b = activeCtx.createOscillator();
      const bGain = activeCtx.createGain();
      b.type = 'triangle';
      b.frequency.setValueAtTime(bass[idx], now);
      bGain.gain.setValueAtTime(0.001, now);
      bGain.gain.exponentialRampToValueAtTime(0.055, now + 0.015);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      b.connect(bGain);
      bGain.connect(activeCtx.destination);
      b.start(now);
      b.stop(now + 0.19);
    } catch {
      // Ignore
    }
  };

  playNote();
  chickenRoadTuneTimer = window.setInterval(playNote, 220);
}

export function stopChickenRoadTune() {
  if (chickenRoadTuneTimer !== null && typeof window !== 'undefined') {
    window.clearInterval(chickenRoadTuneTimer);
    chickenRoadTuneTimer = null;
  }
}


