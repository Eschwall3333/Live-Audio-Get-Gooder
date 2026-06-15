// public/noise-gate-processor.js

class NoiseGateProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
      return [
        { name: 'threshold', defaultValue: -60, minValue: -100, maxValue: 0 },
        { name: 'attack', defaultValue: 0.01, minValue: 0.001, maxValue: 1 }, // Seconds
        { name: 'release', defaultValue: 0.1, minValue: 0.01, maxValue: 1 }, // Seconds
        { name: 'isBypassed', defaultValue: 1, minValue: 0, maxValue: 1 }     // 1 = True, 0 = False
      ];
    }
  
    constructor() {
      super();
      this.gain = 1.0; // Current applied gain
    }
  
    process(inputs, outputs, parameters) {
      const input = inputs[0];
      const output = outputs[0];
      if (!input || !input.length) return true;
  
      const isBypassed = parameters.isBypassed[0] === 1;
      const thresholdDb = parameters.threshold[0];
      const thresholdLinear = Math.pow(10, thresholdDb / 20);
      
      // Time constants for envelope smoothing to prevent audible clicking
      const attack = parameters.attack.length ? parameters.attack[0] : 0.01;
      const release = parameters.release.length ? parameters.release[0] : 0.1;
      const attackCoef = Math.exp(-1 / (attack * sampleRate));
      const releaseCoef = Math.exp(-1 / (release * sampleRate));
  
      for (let channel = 0; channel < input.length; ++channel) {
        const inputChannel = input[channel];
        const outputChannel = output[channel];
  
        for (let i = 0; i < inputChannel.length; ++i) {
          if (isBypassed) {
            outputChannel[i] = inputChannel[i];
            continue;
          }
  
          const absSample = Math.abs(inputChannel[i]);
          
          // Target gain is 1 (open) if above threshold, 0 (closed) if below
          const targetGain = absSample > thresholdLinear ? 1.0 : 0.0;
          
          // Smooth the transition
          if (targetGain > this.gain) {
            this.gain = attackCoef * this.gain + (1 - attackCoef) * targetGain; // Opening
          } else {
            this.gain = releaseCoef * this.gain + (1 - releaseCoef) * targetGain; // Closing
          }
  
          outputChannel[i] = inputChannel[i] * this.gain;
        }
      }
      return true; // Keep processor alive
    }
  }
  
  registerProcessor('noise-gate-processor', NoiseGateProcessor);