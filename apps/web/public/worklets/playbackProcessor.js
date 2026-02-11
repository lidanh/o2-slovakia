/**
 * AudioWorklet processor for audio playback.
 *
 * Features:
 * - Dynamic ring buffer that grows as needed
 * - Pre-buffering: waits for ~300ms of audio before playing
 * - Mark tracking: records positions in the audio stream; notifies when playback reaches them
 * - Clear (barge-in): flushes the buffer instantly when the user starts speaking
 */

const INITIAL_BUFFER_SIZE = 40000; // ~5 seconds at 8kHz
const PREBUFFER_SAMPLES = 2400;    // ~300ms at 8kHz

class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = true;
    this.buffer = new Float32Array(INITIAL_BUFFER_SIZE);
    this.bufferSize = INITIAL_BUFFER_SIZE;
    this.writeIndex = 0;
    this.readIndex = 0;
    this.samplesInBuffer = 0;
    this.totalSamplesWritten = 0;
    this.totalSamplesRead = 0;
    this.marks = [];
    this.isPreBuffering = true;

    this.port.postMessage({ type: "ready" });

    this.port.onmessage = (event) => {
      const { type } = event.data || {};
      switch (type) {
        case "push": {
          const samples = new Float32Array(event.data.samples);
          this.enqueueSamples(samples);
          break;
        }
        case "mark": {
          this.marks.push({
            id: event.data.id,
            position: this.totalSamplesWritten,
          });
          break;
        }
        case "clear": {
          this.buffer = new Float32Array(INITIAL_BUFFER_SIZE);
          this.bufferSize = INITIAL_BUFFER_SIZE;
          this.writeIndex = 0;
          this.readIndex = 0;
          this.samplesInBuffer = 0;
          this.isPreBuffering = true;
          this.marks = [];
          this.port.postMessage({ type: "cleared" });
          break;
        }
        case "stop": {
          this.active = false;
          break;
        }
      }
    };
  }

  growBuffer() {
    const newSize = this.bufferSize + INITIAL_BUFFER_SIZE;
    const newBuffer = new Float32Array(newSize);
    for (let i = 0; i < this.samplesInBuffer; i++) {
      newBuffer[i] = this.buffer[(this.readIndex + i) % this.bufferSize];
    }
    this.buffer = newBuffer;
    this.bufferSize = newSize;
    this.readIndex = 0;
    this.writeIndex = this.samplesInBuffer;
  }

  enqueueSamples(samples) {
    while (this.samplesInBuffer + samples.length > this.bufferSize) {
      this.growBuffer();
    }
    for (let i = 0; i < samples.length; i++) {
      this.buffer[this.writeIndex] = samples[i];
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
      this.samplesInBuffer++;
      this.totalSamplesWritten++;
    }
    if (this.isPreBuffering && this.samplesInBuffer >= PREBUFFER_SAMPLES) {
      this.isPreBuffering = false;
    }
  }

  process(_inputs, outputs) {
    if (!this.active) return false;

    const output = outputs[0]?.[0];
    if (!output) return true;

    if (this.isPreBuffering) {
      output.fill(0);
      return true;
    }

    for (let i = 0; i < output.length; i++) {
      if (this.samplesInBuffer > 0) {
        output[i] = this.buffer[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
        this.samplesInBuffer--;
        this.totalSamplesRead++;
      } else {
        output[i] = 0;
      }
    }

    this.checkMarks();
    return true;
  }

  checkMarks() {
    const reached = [];
    const remaining = [];
    for (const mark of this.marks) {
      if (this.totalSamplesRead >= mark.position) {
        reached.push(mark);
      } else {
        remaining.push(mark);
      }
    }
    this.marks = remaining;
    for (const mark of reached) {
      this.port.postMessage({ type: "markReached", id: mark.id });
    }
  }
}

registerProcessor("playback-processor", PlaybackProcessor);
