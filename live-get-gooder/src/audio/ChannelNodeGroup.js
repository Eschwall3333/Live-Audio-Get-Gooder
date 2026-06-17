export class ChannelNodeGroup {
  constructor(ctx) {
    this.ctx = ctx;

    this.inputNode = this.ctx.createGain();

    this.eqLow = this.ctx.createBiquadFilter();
    this.eqLow.type = 'peaking'; 
    this.eqLow.frequency.value = 80;

    this.eqLowMid = this.ctx.createBiquadFilter();
    this.eqLowMid.type = 'peaking';
    this.eqLowMid.frequency.value = 400;

    this.eqHighMid = this.ctx.createBiquadFilter();
    this.eqHighMid.type = 'peaking';
    this.eqHighMid.frequency.value = 2000;

    this.eqHigh = this.ctx.createBiquadFilter();
    this.eqHigh.type = 'peaking';
    this.eqHigh.frequency.value = 8000;

    // METERING SENSOR
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024; // <-- UPGRADED RESOLUTION FOR RTA
    this.analyser.smoothingTimeConstant = 0.8;

    this.muteGain = this.ctx.createGain();
    this.dcaGain = this.ctx.createGain();
    this.faderGain = this.ctx.createGain();
    
    // --- FIX #1: THE VOLUME GHOST ---
    // Force the fader to initialize at absolute silence so it doesn't blast on boot
    this.faderGain.gain.value = 0; 
    
    this.panNode = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : this.ctx.createGain();
    this.outputNode = this.ctx.createGain();

    this.sendNodes = [];
    for (let i = 0; i < 16; i++) {
      const send = this.ctx.createGain();
      send.gain.value = 0;
      this.sendNodes.push(send);
    }

    // WIRE THE CIRCUIT BOARD (Pre-Fader Metering)
    this.inputNode.connect(this.eqLow);
    this.eqLow.connect(this.eqLowMid);
    this.eqLowMid.connect(this.eqHighMid);
    this.eqHighMid.connect(this.eqHigh);
    
    this.eqHigh.connect(this.analyser);
    this.analyser.connect(this.muteGain);
    
    this.muteGain.connect(this.dcaGain);
    this.dcaGain.connect(this.faderGain);
    this.faderGain.connect(this.panNode);
    this.panNode.connect(this.outputNode);

    for (let i = 0; i < 16; i++) {
      this.faderGain.connect(this.sendNodes[i]);
    }

    this.muteGroupAssignments = [];
    this.dcaAssignments = [];
    this.localFaderDb = -80;
    this.localMute = false;

    this.trackBuffer = null;
    this.trackSource = null;
    this.trackPausedAt = 0;
    this.trackStartedAt = 0;
  }

  setFader(db, globalDcas, globalMutes) {
    if (!this.ctx) return;
    this.localFaderDb = db;
    this.recalculateDcaGain(globalDcas, globalMutes);
  }

  setPan(val) {
    if (!this.ctx || !this.panNode.pan) return;
    this.panNode.pan.setTargetAtTime(val / 100, this.ctx.currentTime, 0.01);
  }

  setSendLevel(index, db) {
    if (!this.ctx) return;
    const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
    this.sendNodes[index].gain.setTargetAtTime(linear, this.ctx.currentTime, 0.01);
  }

  updateMuteAssignments(arr) { this.muteGroupAssignments = arr; }
  updateDcaAssignments(arr) { this.dcaAssignments = arr; }

  recalculateDcaGain(globalDcas, globalMutes) {
    if (!this.ctx) return;
    const isMuted = this.localMute || this.muteGroupAssignments.some(m => globalMutes[m]);
    this.muteGain.gain.setTargetAtTime(isMuted ? 0 : 1, this.ctx.currentTime, 0.01);

    let dcaOffset = 0;
    this.dcaAssignments.forEach(d => { dcaOffset += globalDcas[d]; });

    let finalDb = this.localFaderDb + dcaOffset;
    if (finalDb > 10) finalDb = 10;

    const linear = finalDb <= -60 ? 0 : Math.pow(10, finalDb / 20);
    this.faderGain.gain.setTargetAtTime(linear, this.ctx.currentTime, 0.01);
  }

  setEqBand(band, param, value) {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;
    let targetNode;
    switch(band) {
      case 'low': targetNode = this.eqLow; break;
      case 'lowMid': targetNode = this.eqLowMid; break;
      case 'highMid': targetNode = this.eqHighMid; break;
      case 'high': targetNode = this.eqHigh; break;
      default: return;
    }
    switch(param) {
      case 'freq': targetNode.frequency.setTargetAtTime(value, time, 0.01); break;
      case 'gain': targetNode.gain.setTargetAtTime(value, time, 0.01); break;
      case 'q': targetNode.Q.setTargetAtTime(value, time, 0.01); break;
    }
  }

  setEq(eqData) {
    if (!eqData) return;
    Object.keys(eqData).forEach(band => {
      this.setEqBand(band, 'freq', eqData[band].freq);
      this.setEqBand(band, 'gain', eqData[band].gain);
      this.setEqBand(band, 'q', eqData[band].q);
    });
  }

  loadTrack(buffer) {
    this.trackBuffer = buffer;
    this.trackPausedAt = 0;
  }

  playTrack() {
    if (!this.trackBuffer || !this.ctx) return;
    this.stopTrack(); 
    this.trackSource = this.ctx.createBufferSource();
    this.trackSource.buffer = this.trackBuffer;
    this.trackSource.connect(this.inputNode);
    this.trackSource.start(0, this.trackPausedAt);
    this.trackStartedAt = this.ctx.currentTime - this.trackPausedAt;
  }

  pauseTrack() {
    if (!this.trackSource || !this.ctx) return;
    this.trackSource.stop();
    this.trackPausedAt = this.ctx.currentTime - this.trackStartedAt;
  }

  stopTrack() {
    if (this.trackSource) {
      try { this.trackSource.stop(); } catch(e) {}
      this.trackSource.disconnect();
      this.trackSource = null;
    }
    this.trackPausedAt = 0;
  }

  getLevel() {
    if (!this.ctx || !this.analyser) return -80;
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);
    let db = 20 * Math.log10(rms);
    if (db < -80 || !isFinite(db)) db = -80;
    return db;
  }

  // Pulls the raw frequency spectrum for the RTA
  getFrequencyData(array) {
    if (!this.ctx || !this.analyser) return;
    this.analyser.getByteFrequencyData(array);
  }
}