/**
 * AudioWorklet processor for microphone capture.
 * Accumulates samples into ~20ms chunks and posts them to the main thread.
 */
class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = true;
    this.muted = false;
    this.chunkSize = 960; // ~20ms at 48kHz
    this.buffer = new Float32Array(this.chunkSize);
    this.bufferIndex = 0;

    this.port.onmessage = (event) => {
      if (event.data?.type === "stop") {
        this.active = false;
      } else if (event.data?.type === "mute") {
        if (event.data.muted && !this.muted && this.bufferIndex > 0) {
          const chunk = this.buffer.slice(0, this.bufferIndex);
          this.port.postMessage(
            { type: "chunk", samples: chunk.buffer, sampleRate: sampleRate },
            [chunk.buffer]
          );
          this.buffer = new Float32Array(this.chunkSize);
          this.bufferIndex = 0;
        }
        this.muted = event.data.muted;
      }
    };
  }

  process(inputs) {
    if (!this.active) return false;

    const input = inputs[0]?.[0];
    if (!input || input.length === 0) return true;

    let inputIndex = 0;
    while (inputIndex < input.length) {
      const remaining = this.chunkSize - this.bufferIndex;
      const toCopy = Math.min(remaining, input.length - inputIndex);

      if (this.muted) {
        this.buffer.fill(0, this.bufferIndex, this.bufferIndex + toCopy);
      } else {
        this.buffer.set(
          input.subarray(inputIndex, inputIndex + toCopy),
          this.bufferIndex
        );
      }
      this.bufferIndex += toCopy;
      inputIndex += toCopy;

      if (this.bufferIndex >= this.chunkSize) {
        const chunk = this.buffer.slice();
        this.port.postMessage(
          { type: "chunk", samples: chunk.buffer, sampleRate: sampleRate },
          [chunk.buffer]
        );
        this.buffer = new Float32Array(this.chunkSize);
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor("microphone-processor", MicrophoneProcessor);
