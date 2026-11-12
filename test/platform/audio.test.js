import assert from "node:assert/strict";
import test from "node:test";
import { audio } from "../../src/platform/index.js";
import fakes from "../../src/harness/testing.cjs";

/** A glide of two voices and a chord of three, as an app would define them. @type {Record<string, import("../../src/platform/audio.js").MDLSound>} */
const sounds = {
  glide: {
    gain: .12, dry: .8, wet: .2,
    voices: [
      { start: 0, points: [{ time: 0, frequency: 65.41 }, { time: .085, frequency: 130.81 }], attack: .01, hold: .13, release: .255, gain: .9 },
      { start: .22, points: [{ time: 0, frequency: 196 }, { time: .07, frequency: 392 }], attack: .02, hold: .16, release: .305, gain: 1 }
    ]
  },
  chord: {
    gain: .09, dry: .7, wet: .3,
    voices: [440, 554.37, 659.25].map((frequency, index) => ({ start: index * .05, points: [{ time: 0, frequency }], attack: .004, hold: .02, release: .3, gain: .7 }))
  }
};

function setup() {
  const AudioContext = fakes.audioContext();
  /** @type {Map<number, () => void>} */
  const timers = new Map();
  let next = 1;
  const window = /** @type {any} */ ({
    setTimeout: (/** @type {() => void} */ callback) => { timers.set(next, callback); return next++; },
    clearTimeout: (/** @type {number} */ id) => { timers.delete(id); }
  });
  const synth = audio.create({ window, AudioContext: /** @type {any} */ (AudioContext) });
  return { AudioContext, timers, synth };
}

test("the plate impulse is deterministic seeded noise that decays to silence", () => {
  const first = [new Float32Array(64), new Float32Array(64)];
  const second = [new Float32Array(64), new Float32Array(64)];
  audio.fillPlate(first);
  audio.fillPlate(second);
  assert.deepEqual(first, second);
  assert.notDeepEqual(first[0], first[1], "the channels differ, which widens the reverb");
  assert.ok(Math.abs(first[0][0]) > Math.abs(first[0][63]));
  assert.ok(first[0].every(sample => sample >= -1 && sample <= 1));
});

test("voice timing adds attack, hold and release after the voice start", () => {
  assert.deepEqual(audio.voiceTiming({ start: .2, points: [], attack: .1, hold: .2, release: .3, gain: 1 }, 1), { begin: 1.2, peak: 1.3, held: 1.5, end: 1.8 });
});

test("a sound schedules every voice with its glide and envelope and reuses the reverb buffer", async () => {
  const { AudioContext, synth } = setup();
  await synth.play(sounds.glide);
  const context = AudioContext.instances[0];
  assert.equal(context.oscillators.length, 2);
  const [low, high] = context.oscillators;
  assert.deepEqual(low.frequency.events, [["set", 65.41, .008], ["ramp", 130.81, .093]]);
  assert.equal(high.startedAt, .228);
  assert.ok(Math.abs(/** @type {number} */ (high.stoppedAt) - (.228 + .02 + .16 + .305 + .02)) < 1e-9);
  const bus = context.gains.find(gain => gain.connections.includes(context.destination));
  assert.equal(bus?.gain.value, .12);
  assert.equal(context.gains.filter(gain => gain.gain.value === .8).length, 2, "dry sends");

  await synth.play(sounds.chord);
  assert.equal(context.buffers.length, 1);
  assert.equal(AudioContext.instances.length, 1);
  assert.ok([low, high].every(oscillator => oscillator.disconnected && oscillator.stoppedAt !== null), "a new sound stops the previous one");
  assert.deepEqual(context.oscillators.slice(2).map(oscillator => oscillator.frequency.events.length), [1, 1, 1]);
});

test("the graph is released after the last voice ended and the reverb rang out", async () => {
  const { AudioContext, timers, synth } = setup();
  await synth.play(sounds.chord);
  const context = AudioContext.instances[0];
  const bus = /** @type {any} */ (context.gains.find(gain => gain.connections.includes(context.destination)));
  context.oscillators[0].finish();
  assert.equal(timers.size, 0, "voices are still playing");
  context.oscillators[1].finish();
  context.oscillators[2].finish();
  assert.equal(timers.size, 1);
  [...timers.values()][0]();
  assert.equal(bus.disconnected, true);

  await synth.play(sounds.chord);
  context.oscillators.slice(3).forEach(oscillator => oscillator.finish());
  const release = [...timers.values()].at(-1);
  await synth.play(sounds.chord);
  /** @type {() => void} */ (release)();
  assert.equal(context.gains.filter(gain => gain.connections.includes(context.destination)).at(-1)?.disconnected, false, "a stale release keeps the newer sound");
});

test("muting stops the current sound and drops sounds requested before it", async () => {
  const { AudioContext, synth } = setup();
  await synth.play(sounds.chord);
  const context = AudioContext.instances[0];
  synth.setMuted(true);
  assert.equal(synth.isMuted(), true);
  assert.ok(context.oscillators.every(oscillator => oscillator.disconnected));
  await synth.play(sounds.chord);
  assert.equal(context.oscillators.length, 3);

  synth.setMuted(false);
  const pending = synth.play(sounds.chord);
  synth.setMuted(true);
  await pending;
  assert.equal(context.oscillators.length, 3, "a sound requested before muting does not start");
  synth.setMuted(false);
  const first = synth.play(sounds.chord);
  const second = synth.play(sounds.glide);
  await Promise.all([first, second]);
  assert.equal(context.oscillators.length, 5, "only the latest request plays");
});
