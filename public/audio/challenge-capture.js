/* Capture only: no pitch analysis, network, or recording on the audio thread. */
class ChallengeCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    // Retain at least ~43ms at high sample rates for low vocal fundamentals.
    const windowSize = sampleRate > 48000 ? 4096 : 2048;
    this.ring = new Float32Array(windowSize);
    this.position = 0;
    this.count = 0;
    this.hop = 0;
    this.energy = 0;
    this.droppedHops = 0;
    this.pool = Array.from({ length: 8 }, () => new Float32Array(windowSize));
    this.running = true;
    this.port.onmessage = ({ data }) => {
      if (data.type === "release")
        this.pool.push(new Float32Array(data.buffer));
      if (data.type === "stop") this.running = false;
    };
  }
  process(inputs) {
    if (!this.running) return false;
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      const value = channel[i];
      this.ring[this.position] = value;
      this.position = (this.position + 1) % this.ring.length;
      this.count++;
      this.hop++;
      this.energy += value * value;
      if (this.hop === 512) {
        const frame = currentFrame + i + 1;
        const buffer = this.pool.pop();
        if (buffer && this.count >= this.ring.length) {
          const first = this.ring.length - this.position;
          buffer.set(this.ring.subarray(this.position), 0);
          buffer.set(this.ring.subarray(0, this.position), first);
          this.port.postMessage(
            {
              type: "frame",
              buffer: buffer.buffer,
              streamSampleIndex: frame,
              // Energy timestamps use the 512-sample hop center; pitch uses
              // the longer analysis window. Neither includes device latency.
              audioTimeSec: (frame - 256) / sampleRate,
              pitchAudioTimeSec: (frame - this.ring.length / 2) / sampleRate,
              sampleRate,
              rms: Math.sqrt(this.energy / 512),
              droppedHops: this.droppedHops,
            },
            [buffer.buffer],
          );
          this.droppedHops = 0;
        } else if (buffer) this.pool.push(buffer);
        else this.droppedHops++;
        this.hop = 0;
        this.energy = 0;
      }
    }
    return true;
  }
}
registerProcessor("challenge-capture", ChallengeCapture);
