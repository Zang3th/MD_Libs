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
export function fillPlate(channels: Float32Array[]): void;
/**
 * Timing of one voice, in context seconds.
 * @param {MDLVoice} voice @param {number} start
 */
export function voiceTiming(voice: MDLVoice, start: number): {
    begin: number;
    held: number;
    peak: number;
    end: number;
};
/**
 * A player that plays one sound at a time; a new sound stops the previous one.
 * The audio context is created on the first `play`, which must follow a user gesture.
 * @param {{ window: Window, AudioContext: typeof AudioContext, releaseDelay?: number }} options
 *   `releaseDelay`: ms the reverb tail rings out before the graph is released.
 */
export function create({ window, AudioContext, releaseDelay }: {
    window: Window;
    AudioContext: typeof globalThis.AudioContext;
    releaseDelay?: number;
}): {
    /** @param {MDLSound} sound */
    play(sound: MDLSound): Promise<void>;
    /** @param {boolean} value */
    setMuted(value: boolean): void;
    isMuted: () => boolean;
};
/**
 * Synthesized interface sounds with the Web Audio API: sine voices with pitch glides and an envelope,
 * sent dry to the output and wet through a short plate reverb. No audio files; the app defines its sounds.
 */
export type MDLVoice = {
    /**
     * Seconds after the sound starts.
     */
    start: number;
    /**
     * Pitch in Hz over time (seconds after `start`); exponential glides.
     */
    points: Array<{
        time: number;
        frequency: number;
    }>;
    attack: number;
    hold: number;
    release: number;
    /**
     * Peak gain of the envelope.
     */
    gain: number;
};
/**
 * Synthesized interface sounds with the Web Audio API: sine voices with pitch glides and an envelope,
 * sent dry to the output and wet through a short plate reverb. No audio files; the app defines its sounds.
 */
export type MDLSound = {
    gain: number;
    dry: number;
    wet: number;
    voices: MDLVoice[];
};
