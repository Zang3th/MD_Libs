/**
 * Synthesized interface sounds with the Web Audio API: sine voices with pitch glides and an envelope,
 * sent dry to the output and wet through a short plate reverb. No audio files; the app defines its sounds.
 *
 * @typedef {object} MDLVoice
 * @property {number} start Seconds after the sound starts.
 * @property {Array<{ time: number, frequency: number }>} points Pitch in Hz over time (seconds after `start`); exponential glides.
 * @property {number} attack
 * @property {number} hold
 * @property {number} release
 * @property {number} gain Peak gain of the envelope.
 *
 * @typedef {{ gain: number, dry: number, wet: number, voices: MDLVoice[] }} MDLSound
 */

/**
 * Fills the channels of the plate impulse: seeded noise with a cubic decay, the same on every run.
 * @param {Float32Array[]} channels
 */
export function fillPlate(channels) {
  let seed = 48271;
  for (const samples of channels) {
    for (let index = 0; index < samples.length; index += 1) {
      seed = seed * 16807 % 2147483647;
      samples[index] = (seed / 1073741824 - 1) * Math.pow(1 - index / samples.length, 3);
    }
  }
}

/**
 * Timing of one voice, in context seconds.
 * @param {MDLVoice} voice @param {number} start
 */
export function voiceTiming(voice, start) {
  const begin = start + voice.start;
  return { begin, held: begin + voice.attack + voice.hold, peak: begin + voice.attack, end: begin + voice.attack + voice.hold + voice.release };
}

/**
 * A player that plays one sound at a time; a new sound stops the previous one.
 * The audio context is created on the first `play`, which must follow a user gesture.
 * @param {{ window: Window, AudioContext: typeof AudioContext, releaseDelay?: number }} options
 *   `releaseDelay`: ms the reverb tail rings out before the graph is released.
 */
export function create({ window, AudioContext, releaseDelay = 1000 }) {
  /** @type {AudioContext | null} */
  let context = null;
  /** @type {OscillatorNode[]} */
  let activeSources = [];
  /** @type {GainNode | null} */
  let activeBus = null;
  /** @type {AudioBuffer | null} */
  let plateImpulse = null;
  /** @type {number | null} */
  let cleanupTimer = null;
  let requestId = 0;
  let muted = false;

  function stopActive() {
    if (cleanupTimer !== null) window.clearTimeout(cleanupTimer);
    cleanupTimer = null;
    if (activeBus && context) {
      activeBus.gain.cancelScheduledValues(context.currentTime);
      activeBus.gain.setValueAtTime(0, context.currentTime);
      activeBus.disconnect();
    }
    for (const source of activeSources) {
      try { source.stop(); } catch { /* Already stopped. */ }
      source.disconnect();
    }
    activeSources = [];
    activeBus = null;
  }

  /** @param {AudioContext} audio @param {GainNode} bus */
  function createPlate(audio, bus) {
    const plate = audio.createConvolver();
    if (!plateImpulse) {
      plateImpulse = audio.createBuffer(2, audio.sampleRate, audio.sampleRate);
      fillPlate(Array.from({ length: plateImpulse.numberOfChannels }, (_, channel) => /** @type {AudioBuffer} */ (plateImpulse).getChannelData(channel)));
    }
    plate.buffer = plateImpulse;
    plate.connect(bus);
    return plate;
  }

  /** @param {AudioContext} audio @param {GainNode} bus @param {ConvolverNode} plate @param {MDLSound} sound @param {MDLVoice} voice @param {number} start */
  function playVoice(audio, bus, plate, sound, voice, start) {
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    const dry = audio.createGain();
    const wet = audio.createGain();
    const timing = voiceTiming(voice, start);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(voice.points[0].frequency, timing.begin + voice.points[0].time);
    for (const point of voice.points.slice(1)) oscillator.frequency.exponentialRampToValueAtTime(point.frequency, timing.begin + point.time);
    envelope.gain.setValueAtTime(.0001, timing.begin);
    envelope.gain.exponentialRampToValueAtTime(voice.gain, timing.peak);
    envelope.gain.setValueAtTime(voice.gain, timing.held);
    envelope.gain.exponentialRampToValueAtTime(.0001, timing.end);
    dry.gain.value = sound.dry;
    wet.gain.value = sound.wet;
    oscillator.connect(envelope);
    envelope.connect(dry).connect(bus);
    envelope.connect(wet).connect(plate);
    oscillator.start(timing.begin);
    oscillator.stop(timing.end + .02);
    activeSources.push(oscillator);
    oscillator.addEventListener("ended", () => {
      activeSources = activeSources.filter(source => source !== oscillator);
      oscillator.disconnect();
      if (activeSources.length || activeBus !== bus) return;
      cleanupTimer = window.setTimeout(() => {
        cleanupTimer = null;
        if (activeBus !== bus) return;
        bus.disconnect();
        activeBus = null;
      }, releaseDelay);
    }, { once: true });
  }

  return {
    /** @param {MDLSound} sound */
    async play(sound) {
      if (muted) return;
      const current = ++requestId;
      context ||= new AudioContext();
      const audio = context;
      await audio.resume();
      if (muted || current !== requestId) return;
      stopActive();
      const bus = audio.createGain();
      bus.gain.value = sound.gain;
      bus.connect(audio.destination);
      activeBus = bus;
      const plate = createPlate(audio, bus);
      const start = audio.currentTime + .008;
      for (const voice of sound.voices) playVoice(audio, bus, plate, sound, voice, start);
    },
    /** @param {boolean} value */
    setMuted(value) {
      muted = value;
      if (muted) {
        requestId += 1;
        stopActive();
      }
    },
    isMuted: () => muted
  };
}
