export class ChannelNodeGroup {
    constructor(ctx) {
      this.ctx = ctx;
      this.isPhaseInverted = false;
      this.currentGaindB = 0;
      this.trackBuffer = null; this.trackSource = null; this.isPlaying = false; this.playOffset = 0; this.lastPlayTime = 0;
  
      // DCA Math State
      this.baseFaderDb = 0;
      this.assignedDcas = [];
  
      this.inputNode = ctx.createGain();
      this.hpfNode = ctx.createBiquadFilter();
      this.gateNode = new AudioWorkletNode(ctx, 'noise-gate-processor');
      this.eqLow = ctx.createBiquadFilter(); this.eqLowMid = ctx.createBiquadFilter(); this.eqHighMid = ctx.createBiquadFilter(); this.eqHigh = ctx.createBiquadFilter();
      this.compNode = ctx.createDynamicsCompressor();
      this.analyserNode = ctx.createAnalyser(); this.analyserNode.fftSize = 256;
      this.faderNode = ctx.createGain();
      this.panNode = ctx.createStereoPanner();
  
      this.hpfNode.type = 'highpass'; this.hpfNode.frequency.value = 20;
      this.eqLow.type = 'lowshelf'; this.eqLow.frequency.value = 100;
      this.eqLowMid.type = 'peaking'; this.eqLowMid.frequency.value = 400; this.eqLowMid.Q.value = 1.0;
      this.eqHighMid.type = 'peaking'; this.eqHighMid.frequency.value = 2000; this.eqHighMid.Q.value = 1.0;
      this.eqHigh.type = 'highshelf'; this.eqHigh.frequency.value = 10000;
      this.compNode.threshold.value = 0; this.compNode.ratio.value = 2; this.compNode.attack.value = 0.01; this.compNode.release.value = 0.1;
  
      this.sendNodes = [];
      for (let i = 0; i < 16; i++) {
        const sendGain = ctx.createGain();
        sendGain.gain.value = 0;
        this.sendNodes.push(sendGain);
      }
  
      this.inputNode.connect(this.hpfNode); this.hpfNode.connect(this.gateNode); this.gateNode.connect(this.eqLow);
      this.eqLow.connect(this.eqLowMid); this.eqLowMid.connect(this.eqHighMid); this.eqHighMid.connect(this.eqHigh); this.eqHigh.connect(this.compNode);
      for (let i = 0; i < 16; i++) this.compNode.connect(this.sendNodes[i]);
      this.compNode.connect(this.analyserNode); this.analyserNode.connect(this.faderNode); this.faderNode.connect(this.panNode);
      
      this.outputNode = this.panNode;
    }
  
    // --- DCA & FADER MATH ---
    updateDcaAssignments(dcaArray) {
      this.assignedDcas = dcaArray;
    }
  
    setFader(db, globalDcaLevels) {
      this.baseFaderDb = db;
      this.recalculateDcaGain(globalDcaLevels);
    }
  
    recalculateDcaGain(globalDcaLevels) {
      let dcaOffset = 0;
      for (let dcaIdx of this.assignedDcas) {
        dcaOffset += globalDcaLevels[dcaIdx]; // Combine offsets from all assigned DCAs
      }
      
      let finalDb = this.baseFaderDb + dcaOffset;
      
      // Hard mute if fader or combined DCA offset drops it below -60
      if (this.baseFaderDb <= -60 || finalDb <= -60) {
        this.faderNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
      } else {
        // Ceiling limit to prevent digital clipping from DCA boosts
        if (finalDb > 10) finalDb = 10; 
        const linear = Math.pow(10, finalDb / 20);
        this.faderNode.gain.setTargetAtTime(linear, this.ctx.currentTime, 0.01);
      }
    }
  
    setSendLevel(busIndex, db) { if (this.sendNodes[busIndex]) { const linear = db <= -60 ? 0 : Math.pow(10, db / 20); this.sendNodes[busIndex].gain.setTargetAtTime(linear, this.ctx.currentTime, 0.01); } }
    loadTrack(buffer) { if (this.isPlaying) this.stopTrack(); this.trackBuffer = buffer; this.playOffset = 0; }
    playTrack() { if (!this.trackBuffer || this.isPlaying) return; this.trackSource = this.ctx.createBufferSource(); this.trackSource.buffer = this.trackBuffer; this.trackSource.loop = true; this.trackSource.connect(this.inputNode); this.trackSource.start(0, this.playOffset); this.lastPlayTime = this.ctx.currentTime; this.isPlaying = true; }
    pauseTrack() { if (!this.isPlaying) return; this.trackSource.stop(); this.playOffset += this.ctx.currentTime - this.lastPlayTime; this.playOffset = this.playOffset % this.trackBuffer.duration; this.isPlaying = false; }
    stopTrack() { if (this.isPlaying) this.trackSource.stop(); this.playOffset = 0; this.isPlaying = false; }
    getMeterLevel() { const dataArray = new Float32Array(this.analyserNode.fftSize); this.analyserNode.getFloatTimeDomainData(dataArray); let sumSquares = 0; for (let i = 0; i < dataArray.length; i++) sumSquares += dataArray[i] * dataArray[i]; const rms = Math.sqrt(sumSquares / dataArray.length); let db = 20 * Math.log10(rms); return (!isFinite(db) || db < -80) ? -80 : db; }
    setGain(db) { this.currentGaindB = db; this.applyGainAndPhase(); }
    setPhase(inverted) { this.isPhaseInverted = inverted; this.applyGainAndPhase(); }
    applyGainAndPhase() { let linearGain = Math.pow(10, this.currentGaindB / 20); if (this.isPhaseInverted) linearGain = -linearGain; this.inputNode.gain.setTargetAtTime(linearGain, this.ctx.currentTime, 0.01); }
    setHPF(enabled, freq) { const targetFreq = enabled ? freq : 20; this.hpfNode.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.01); }
    setGate(enabled, threshold, attackMs = 10, releaseMs = 100) { const gateParams = this.gateNode.parameters; const time = this.ctx.currentTime; gateParams.get('isBypassed').setTargetAtTime(enabled ? 0 : 1, time, 0.01); gateParams.get('threshold').setTargetAtTime(threshold, time, 0.01); gateParams.get('attack').setTargetAtTime(attackMs / 1000, time, 0.01); gateParams.get('release').setTargetAtTime(releaseMs / 1000, time, 0.01); }
    setEqBand(band, gain, freq, q = 1.0) { const node = this[`eq${band}`]; if (node) { node.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.01); node.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.01); if (node.type === 'peaking') node.Q.setTargetAtTime(q, this.ctx.currentTime, 0.01); } }
    setCompressor(enabled, threshold, ratio, attackMs, releaseMs) { const targetThreshold = enabled ? threshold : 0; this.compNode.threshold.setTargetAtTime(targetThreshold, this.ctx.currentTime, 0.01); this.compNode.ratio.setTargetAtTime(ratio, this.ctx.currentTime, 0.01); this.compNode.attack.setTargetAtTime(attackMs / 1000, this.ctx.currentTime, 0.01); this.compNode.release.setTargetAtTime(releaseMs / 1000, this.ctx.currentTime, 0.01); }
    setPan(value) { this.panNode.pan.setTargetAtTime(value, this.ctx.currentTime, 0.01); }
  }