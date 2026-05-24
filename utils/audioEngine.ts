"use client";

class AudioEngine {
  private ctx: AudioContext | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private mainGain: GainNode | null = null;
  private windNoise: ScriptProcessorNode | null = null;
  private windGain: GainNode | null = null;
  private running = false;
  private muted = false;

  start() {
    if (this.running || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      
      // Main output volume
      this.mainGain = this.ctx.createGain();
      this.mainGain.gain.value = 0.0; // Start silent, fade in
      this.mainGain.connect(this.ctx.destination);
      
      // Oscillator 1 (sawtooth for engine rumble)
      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = "sawtooth";
      this.osc1.frequency.value = 40; // idle freq
      
      // Oscillator 2 (triangle for low-end body)
      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = "triangle";
      this.osc2.frequency.value = 20; // sub-harmonic
      
      // Low pass filter to shape the sound
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.Q.value = 2.5;
      this.filter.frequency.value = 160;
      
      // Connect engine parts
      this.osc1.connect(this.filter);
      this.osc2.connect(this.filter);
      
      const engineGain = this.ctx.createGain();
      engineGain.gain.value = 0.28;
      this.filter.connect(engineGain);
      engineGain.connect(this.mainGain);
      
      this.osc1.start(0);
      this.osc2.start(0);
      
      // Generate wind noise
      const bufferSize = 4096;
      this.windNoise = this.ctx.createScriptProcessor(bufferSize, 1, 1);
      this.windNoise.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2.0 - 1.0;
        }
      };
      
      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = "bandpass";
      windFilter.frequency.value = 350;
      windFilter.Q.value = 1.2;
      
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.0;
      
      this.windNoise.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.mainGain);
      
      this.running = true;
      this.fadeTo(this.muted ? 0.0 : 0.12, 0.2);
    } catch (e) {
      console.warn("Failed to start audio engine", e);
    }
  }

  setMute(mute: boolean) {
    this.muted = mute;
    if (this.mainGain && this.ctx) {
      this.mainGain.gain.linearRampToValueAtTime(
        mute ? 0.0 : 0.12,
        this.ctx.currentTime + 0.15
      );
    }
  }

  toggleMute() {
    this.setMute(!this.muted);
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  isRunning() {
    return this.running;
  }

  private fadeTo(val: number, duration: number) {
    if (this.mainGain && this.ctx) {
      this.mainGain.gain.linearRampToValueAtTime(val, this.ctx.currentTime + duration);
    }
  }

  update(speed: number, accelerationInput: boolean) {
    if (!this.running || !this.ctx || this.muted) return;
    
    // Simulate engine gear shift logic
    // Speed ranges from 0 to 150
    let gear = 1;
    let rpmFrac = 0;
    
    if (speed > 110) {
      gear = 4;
      rpmFrac = (speed - 110) / 40;
    } else if (speed > 65) {
      gear = 3;
      rpmFrac = (speed - 65) / 45;
    } else if (speed > 28) {
      gear = 2;
      rpmFrac = (speed - 28) / 37;
    } else {
      gear = 1;
      rpmFrac = speed / 28;
    }
    
    // Clamp RPM fraction
    rpmFrac = Math.max(0.0, Math.min(1.1, rpmFrac));
    
    // Engine sound frequencies: idle ~32Hz, redline ~90Hz
    const baseFreq = 30 + gear * 6 + rpmFrac * 42;
    const filterFreq = 110 + rpmFrac * 320 + (accelerationInput ? 70 : 0);
    
    // Smooth transition
    const t = this.ctx.currentTime;
    if (this.osc1) {
      this.osc1.frequency.setTargetAtTime(baseFreq, t, 0.08);
    }
    if (this.osc2) {
      this.osc2.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.08);
    }
    if (this.filter) {
      this.filter.frequency.setTargetAtTime(filterFreq, t, 0.1);
    }
    
    // Wind noise scales with speed
    if (this.windGain) {
      const targetWindGain = Math.min(0.09, (speed / 150) * 0.09);
      this.windGain.gain.setTargetAtTime(targetWindGain, t, 0.15);
    }
  }

  stop() {
    if (!this.running) return;
    try {
      this.osc1?.stop();
      this.osc2?.stop();
      this.windNoise?.disconnect();
      this.ctx?.close();
    } catch(e) {}
    this.running = false;
    this.ctx = null;
    this.osc1 = null;
    this.osc2 = null;
    this.filter = null;
    this.mainGain = null;
    this.windNoise = null;
    this.windGain = null;
  }
}

// Create a single global instance
export const audioEngine = new AudioEngine();
