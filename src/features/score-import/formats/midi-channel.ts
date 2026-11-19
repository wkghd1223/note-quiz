// Pitch wheel and registered parameter state belongs to the MIDI port/channel,
// even when a conductor track sends the control messages for a different part.
export class MidiPitchChanges {
  readonly spans: { start: number; end: number }[] = [];
  private wheel = 8192;
  private rpnMsb = 127;
  private rpnLsb = 127;
  // Each value stores its Data Entry MSB/LSB (seven bits each).
  private readonly parameters = [2 * 128, 8192, 64 * 128];

  pitchWheel(tick: number, lsb: number, msb: number) {
    this.wheel = msb * 128 + lsb;
    this.update(tick);
  }

  control(tick: number, key: number, value: number) {
    switch (key) {
      case 121: // Reset controllers centers the wheel and clears RPN selection.
        this.wheel = 8192;
        this.rpnMsb = this.rpnLsb = 127;
        break;
      case 101:
        this.rpnMsb = value;
        return;
      case 100:
        this.rpnLsb = value;
        return;
      case 98:
      case 99: // An NRPN is now selected.
        this.rpnMsb = this.rpnLsb = 127;
        return;
      case 6: // Data Entry MSB
      case 38: // Data Entry LSB
      case 96: // Data Increment
      case 97: {
        // Data Decrement
        if (this.rpnMsb !== 0 || this.rpnLsb > 2) return;
        const current = this.parameters[this.rpnLsb];
        let next;
        if (key === 6) next = value * 128 + (current & 127);
        else if (key === 38) next = (current & ~127) + value;
        else {
          const step = this.rpnLsb === 2 ? 128 : 1;
          next = Math.min(
            16383,
            Math.max(0, current + (key === 96 ? step : -step)),
          );
        }
        this.parameters[this.rpnLsb] = next;
        break;
      }
      default:
        return;
    }
    this.update(tick);
  }

  private update(tick: number) {
    const [sensitivity, fine, coarse] = this.parameters;
    const shifted =
      (this.wheel !== 8192 && sensitivity !== 0) ||
      fine !== 8192 ||
      coarse >> 7 !== 64;
    const last = this.spans.at(-1);
    if (shifted && last?.end !== Infinity) {
      this.spans.push({ start: tick, end: Infinity });
    } else if (!shifted && last?.end === Infinity) {
      if (tick === last.start) this.spans.pop();
      else last.end = tick;
    }
  }
}
