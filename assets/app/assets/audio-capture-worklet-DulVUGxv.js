class GeminiAudioCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = Math.max(256, Math.round(sampleRate * 0.03));
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (input) {
      for (let index = 0; index < input.length; index += 1) {
        this.buffer[this.bufferIndex++] = input[index];
        if (this.bufferIndex === this.bufferSize) {
          const chunk = this.buffer.slice();
          this.port.postMessage(chunk, [chunk.buffer]);
          this.bufferIndex = 0;
        }
      }
    }

    for (const output of outputs[0] || []) output.fill(0);
    return true;
  }
}

registerProcessor("gemini-audio-capture", GeminiAudioCapture);
