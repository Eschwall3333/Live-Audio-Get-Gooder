import { ChannelNodeGroup } from './ChannelNodeGroup';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.channels = new Map();
    this.physicalInputs = {}; // <--- NEW: 32 Physical Hardware Jacks
    this.masterGain = null;
    this.feedbackActive = false;
    this.toneActive = false;
    this.toneGain = null;
    this.toneSource = null; 
    this.globalDcaLevels = Array(8).fill(0); // 8 DCAs starting at 0dB
    this.globalMuteGroups = Array(6).fill(false); // 6 Mute Groups, starting un-muted
    
    // Tape Machine variables
    this.tapeBuffer = null;
    this.tapeSource = null;
  }

  async init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
    
    // Attempt to load worklet, fail gracefully if it doesn't exist yet
    try {
      await this.ctx.audioWorklet.addModule('/noise-gate-processor.js');
    } catch (e) {
      console.warn("AudioWorklet not found. Gate will be bypassed until file exists.");
    }

    // ==========================================
    // 0. PHYSICAL INPUTS (THE PATCHBAY JACKS)
    // ==========================================
    for (let i = 1; i <= 32; i++) {
      this.physicalInputs[i] = this.ctx.createGain();
      this.physicalInputs[i].gain.value = 1.0; 
    }
    
    // ==========================================
    // 1. MASTER LR & MULTIBAND COMPRESSOR
    // ==========================================
    this.masterGain = this.ctx.createGain(); 

    this.mbcInput = this.ctx.createGain();
    this.mbcOutput = this.ctx.createGain();

    const createLRFilter = (type, freq) => {
      const f1 = this.ctx.createBiquadFilter(); f1.type = type; f1.frequency.value = freq;
      const f2 = this.ctx.createBiquadFilter(); f2.type = type; f2.frequency.value = freq;
      f1.connect(f2);
      return { in: f1, out: f2 };
    };

    this.xLow = createLRFilter('lowpass', 250); 
    this.xMidLow = createLRFilter('highpass', 250); 
    this.xMidHigh = createLRFilter('lowpass', 2500); 
    this.xHigh = createLRFilter('highpass', 2500); 
    
    this.xMidLow.out.connect(this.xMidHigh.in);

    this.compLow = this.ctx.createDynamicsCompressor();
    this.compMid = this.ctx.createDynamicsCompressor();
    this.compHigh = this.ctx.createDynamicsCompressor();
    
    this.makeupLow = this.ctx.createGain();
    this.makeupMid = this.ctx.createGain();
    this.makeupHigh = this.ctx.createGain();

    this.mbcInput.connect(this.xLow.in);
    this.xLow.out.connect(this.compLow);
    this.compLow.connect(this.makeupLow);
    this.makeupLow.connect(this.mbcOutput);

    this.mbcInput.connect(this.xMidLow.in);
    this.xMidHigh.out.connect(this.compMid);
    this.compMid.connect(this.makeupMid);
    this.makeupMid.connect(this.mbcOutput);

    this.mbcInput.connect(this.xHigh.in);
    this.xHigh.out.connect(this.compHigh);
    this.compHigh.connect(this.makeupHigh);
    this.makeupHigh.connect(this.mbcOutput);

    this.masterLimiter = this.ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -3; this.masterLimiter.ratio.value = 20; this.masterLimiter.attack.value = 0.001; this.masterLimiter.release.value = 0.1;
    
    this.masterFaderGain = this.ctx.createGain(); 
    this.masterFaderGain.gain.value = 1.0; 
    
    this.masterSplitter = this.ctx.createChannelSplitter(2);
    this.masterAnalyserL = this.ctx.createAnalyser(); this.masterAnalyserR = this.ctx.createAnalyser();
    this.masterAnalyserL.fftSize = 256; this.masterAnalyserR.fftSize = 256;
    
    this.masterGain.connect(this.mbcInput);
    this.mbcOutput.connect(this.masterLimiter); 
    this.masterLimiter.connect(this.masterFaderGain);
    this.masterFaderGain.connect(this.masterSplitter);
    this.masterSplitter.connect(this.masterAnalyserL, 0); 
    this.masterSplitter.connect(this.masterAnalyserR, 1); 
    this.masterFaderGain.connect(this.ctx.destination); 

    // ==========================================
    // 2. TONE GENERATOR INFRASTRUCTURE
    // ==========================================
    this.toneOsc = null;
    this.toneGain = this.ctx.createGain();
    this.toneGain.gain.value = 0; 
    this.currentToneDest = this.masterGain; 
    this.toneGain.connect(this.currentToneDest);

    // ==========================================
    // 3. MATRIX MASTERS (6)
    // ==========================================
    this.matrixMasters = [];
    for (let i = 0; i < 6; i++) {
      const mtxGain = this.ctx.createGain();
      mtxGain.gain.value = 1.0; 
      mtxGain.connect(this.ctx.destination);
      this.matrixMasters.push(mtxGain);
    }

    // ==========================================
    // 4. MIX BUSES (16)
    // ==========================================
    this.busMasters = [];
    this.busToMatrixSends = Array(16).fill(null).map(() => Array(6).fill(null));

    for (let b = 0; b < 16; b++) {
      const busGain = this.ctx.createGain();
      busGain.gain.value = 1.0; 
      this.busMasters.push(busGain);

      for (let m = 0; m < 6; m++) {
        const sendNode = this.ctx.createGain();
        sendNode.gain.value = 0; 
        busGain.connect(sendNode);
        sendNode.connect(this.matrixMasters[m]);
        this.busToMatrixSends[b][m] = sendNode;
      }
    } 

    // ==========================================
    // 5. FX RACK 1: PLATE REVERB
    // ==========================================
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this.generateReverbIR(2.5, 3.0); 
    
    this.fx1ReturnFader = this.ctx.createGain();
    this.fx1ReturnFader.gain.value = 1.0; 
    
    const bus13Master = this.busMasters[12]; 
    bus13Master.connect(this.reverbNode);
    this.reverbNode.connect(this.fx1ReturnFader);
    this.fx1ReturnFader.connect(this.masterGain);

    // ==========================================
    // 6. INPUT CHANNELS (32)
    // ==========================================
    for (let i = 1; i <= 32; i++) {
      const channelNodes = new ChannelNodeGroup(this.ctx);
      channelNodes.outputNode.connect(this.masterGain); 
      for (let b = 0; b < 16; b++) {
        channelNodes.sendNodes[b].connect(this.busMasters[b]);
      }
      
      // Default 1:1 Routing Patch (Input 1 -> Channel 1, Input 2 -> Channel 2, etc.)
      if (this.physicalInputs[i] && channelNodes.inputNode) {
        this.physicalInputs[i].connect(channelNodes.inputNode);
      }

      this.channels.set(i, channelNodes);
    }
  }

  // ==========================================
  // SPATIAL AUDIO GENERATOR
  // ==========================================
  generateReverbIR(duration = 2.5, decay = 3.0) {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    
    for (let i = 0; i < 2; i++) {
      const channelData = impulse.getChannelData(i);
      for (let j = 0; j < length; j++) {
        channelData[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, decay);
      }
    }
    return impulse;
  }

  // ==========================================
  // ROUTING & CONTROL METHODS
  // ==========================================
  getChannel(id) {
    const ch = this.channels.get(id);
    if (!ch) throw new Error(`Audio Channel ${id} not initialized.`);
    return ch;
  }

  // --- NEW: THE DIGITAL PATCH CABLE ---
  routeInputToChannel(inputId, channelId) {
    const inputNode = this.physicalInputs[inputId];
    const channel = this.getChannel(channelId);

    if (!inputNode || !channel || !channel.inputNode) return;

    // 1. Unplug this channel from ALL physical inputs to silence it
    for (let i = 1; i <= 32; i++) {
      try {
        this.physicalInputs[i].disconnect(channel.inputNode);
      } catch(e) {
        // Ignored: Web Audio throws an error if you disconnect a node that wasn't connected
      }
    }

    // 2. Plug the newly selected physical input into the channel
    inputNode.connect(channel.inputNode);
    
    console.log(`[PATCHBAY] Physical Input IN${inputId} routed to Channel ${channelId}`);
  }

  updateBusMatrixRouting(busIndex, matrixAssignmentsArray) {
    if (!this.ctx) return;
    for (let m = 0; m < 6; m++) {
      const isPatched = matrixAssignmentsArray.includes(m);
      this.busToMatrixSends[busIndex][m].gain.setTargetAtTime(isPatched ? 1 : 0, this.ctx.currentTime, 0.01);
    }
  }

  setMatrixLevel(matrixIndex, db) {
    if (!this.ctx) return;
    const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
    this.matrixMasters[matrixIndex].gain.setTargetAtTime(linear, this.ctx.currentTime, 0.01);
  }

  setChannelSendLevel(channelId, busIndex, db) {
    if (!this.ctx) return;
    this.getChannel(channelId).setSendLevel(busIndex, db);
  }

  setChannelFader(channelId, db) {
    if (!this.ctx) return;
    this.getChannel(channelId).setFader(db, this.globalDcaLevels, this.globalMuteGroups);
  }

  updateChannelMuteRouting(channelId, muteArray) {
    if (!this.ctx) return;
    this.getChannel(channelId).updateMuteAssignments(muteArray);
    this.getChannel(channelId).recalculateDcaGain(this.globalDcaLevels, this.globalMuteGroups);
  }

  setMuteGroupState(muteGroupIndex, isActive) {
    if (!this.ctx) return;
    this.globalMuteGroups[muteGroupIndex] = isActive;
    for (let [id, ch] of this.channels) {
      ch.recalculateDcaGain(this.globalDcaLevels, this.globalMuteGroups);
    }
  }

  updateChannelDcaRouting(channelId, dcaArray) {
    if (!this.ctx) return;
    this.getChannel(channelId).updateDcaAssignments(dcaArray);
    this.getChannel(channelId).recalculateDcaGain(this.globalDcaLevels, this.globalMuteGroups);
  }

  setDcaLevel(dcaIndex, db) {
    if (!this.ctx) return;
    this.globalDcaLevels[dcaIndex] = db;
    for (let [id, ch] of this.channels) {
      ch.recalculateDcaGain(this.globalDcaLevels, this.globalMuteGroups);
    }
  }

  setMasterFader(db) {
    if (!this.ctx) return;
    const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
    this.masterFaderGain.gain.setTargetAtTime(linear, this.ctx.currentTime, 0.01);
  }

  setMasterMultiband(active, low, mid, high) {
    if (!this.ctx || !this.compLow) return;
    const time = this.ctx.currentTime;
    
    const applyBand = (compNode, makeupNode, params) => {
      compNode.threshold.setTargetAtTime(active ? params.thresh : 0, time, 0.01);
      compNode.ratio.setTargetAtTime(active ? params.ratio : 1, time, 0.01);
      compNode.attack.setTargetAtTime(0.02, time, 0.01); 
      compNode.release.setTargetAtTime(0.15, time, 0.01); 
      const linearGain = Math.pow(10, params.gain / 20);
      makeupNode.gain.setTargetAtTime(linearGain, time, 0.01);
    };

    applyBand(this.compLow, this.makeupLow, low);
    applyBand(this.compMid, this.makeupMid, mid);
    applyBand(this.compHigh, this.makeupHigh, high);
  }

  setFxReturnLevel(fxIndex, db) {
    if (!this.ctx || !this.fx1ReturnFader) return;
    const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
    if (fxIndex === 0) {
      this.fx1ReturnFader.gain.setTargetAtTime(linear, this.ctx.currentTime, 0.01);
    }
  }

  getMasterMeterLevels() {
    if (!this.ctx || this.ctx.state !== 'running' || !this.masterAnalyserL || !this.masterAnalyserR) {
      return { l: -80, r: -80 };
    }
    const calcDb = (analyser) => {
      if (!analyser.fftSize) return -80; 
      const dataArray = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) sumSquares += dataArray[i] * dataArray[i];
      const rms = Math.sqrt(sumSquares / dataArray.length);
      let db = 20 * Math.log10(rms);
      return (!isFinite(db) || db < -80) ? -80 : db;
    };
    return { l: calcDb(this.masterAnalyserL), r: calcDb(this.masterAnalyserR) };
  }

  // ==========================================
  // TONE GENERATOR
  // ==========================================
  setToneRouting(destType, destId) {
    if (!this.ctx || !this.toneGain) return;
    this.toneGain.disconnect();
    if (destType === 'MAIN') {
      this.currentToneDest = this.masterGain;
    } else if (destType === 'CH') {
      this.currentToneDest = this.getChannel(destId).inputNode;
    } else if (destType === 'BUS') {
      this.currentToneDest = this.busMasters[destId - 1]; 
    }
    this.toneGain.connect(this.currentToneDest);
  }

  startTone(type = 'sine', freq = 1000, levelDb = -18) {
    if (!this.ctx) return;
    this.stopTone(); 
    this.toneGain = this.ctx.createGain();
    this.toneGain.gain.value = Math.pow(10, levelDb / 20);
    this.toneGain.connect(this.currentToneDest || this.masterLimiter); 

    if (type === 'pink' || type === 'white') {
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
      this.toneSource = this.ctx.createBufferSource();
      this.toneSource.buffer = noiseBuffer;
      this.toneSource.loop = true;
    } else {
      this.toneSource = this.ctx.createOscillator();
      this.toneSource.type = 'sine';
      this.toneSource.frequency.value = freq;
    }
    this.toneSource.connect(this.toneGain);
    this.toneSource.start();
    this.toneActive = true;
  }

  playTone(freq, type = 'sine') {
    this.startTone(type, freq, -18);
  }

  updateToneLevel(levelDb) {
    if (this.toneActive && this.toneGain) {
      this.toneGain.gain.setTargetAtTime(Math.pow(10, levelDb / 20), this.ctx.currentTime, 0.01);
    }
  }

  stopTone() {
    if (this.toneActive && this.toneSource) {
      this.toneSource.stop();
      this.toneSource.disconnect();
      if (this.toneGain) this.toneGain.disconnect();
    }
    this.toneActive = false;
  }

  // ==========================================
  // TAPE MACHINE (Rewired for Patchbay)
  // ==========================================
  loadTrackIntoChannel(inputId, audioBuffer) {
    if (!this.ctx) return;
    this.tapeBuffer = audioBuffer;
    this.tapeInputId = inputId; // Store which physical jack it's plugged into
  }

  playChannelTrack(inputId) { 
    if (!this.ctx || !this.tapeBuffer) return;
    this.stopChannelTrack(); // Clear old track if exists
    
    this.tapeSource = this.ctx.createBufferSource();
    this.tapeSource.buffer = this.tapeBuffer;
    
    // Plug the Tape Machine directly into the Physical Hardware Jack
    const targetJack = inputId || this.tapeInputId || 1;
    if (this.physicalInputs[targetJack]) {
      this.tapeSource.connect(this.physicalInputs[targetJack]);
    }
    
    this.tapeSource.start();
  }
  
  pauseChannelTrack() { 
    this.stopChannelTrack(); 
  }
  
  stopChannelTrack() { 
    if (this.tapeSource) {
      try { this.tapeSource.stop(); this.tapeSource.disconnect(); } catch (e) {}
      this.tapeSource = null;
    }
  }

  // ==========================================
  // FEEDBACK SIMULATOR
  // ==========================================
  spawnFeedbackLoop(targetChannelId) {
    if (!this.ctx || this.feedbackActive) return;
    this.feedbackDelay = this.ctx.createDelay(1.0);
    this.feedbackDelay.delayTime.value = 0.01;
    this.roomResonance = this.ctx.createBiquadFilter();
    this.roomResonance.type = 'peaking';
    this.roomResonance.frequency.value = 3150; 
    this.roomResonance.Q.value = 15; 
    this.roomResonance.gain.value = 20; 
    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.value = 0.95; 

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * 0.0001; 
    
    this.noiseFloor = this.ctx.createBufferSource();
    this.noiseFloor.buffer = noiseBuffer;
    this.noiseFloor.loop = true;
    
    this.noiseFloor.connect(this.roomResonance);
    this.masterGain.connect(this.feedbackGain);
    this.feedbackGain.connect(this.feedbackDelay);
    this.feedbackDelay.connect(this.roomResonance);
    
    const targetChannel = this.getChannel(targetChannelId);
    this.roomResonance.connect(targetChannel.inputNode);
    
    this.noiseFloor.start();
    this.feedbackActive = true;
  }

  killFeedbackLoop() {
    if (!this.feedbackActive) return;
    this.masterGain.disconnect(this.feedbackGain);
    this.feedbackGain.disconnect();
    this.feedbackDelay.disconnect();
    this.roomResonance.disconnect();
    this.noiseFloor.stop();
    this.noiseFloor.disconnect();
    this.feedbackActive = false;
  }

  // ==========================================
  // SHOW CONTROL: TOTAL RECALL SYNC
  // ==========================================
  syncToState(mixerState) {
    if (!this.ctx) return;

    mixerState.dcas.forEach((dca, index) => {
      this.setDcaLevel(index, dca.faderLevel);
    });
    
    mixerState.muteGroups.forEach((mg, index) => {
      this.setMuteGroupState(index, mg.active);
    });

    this.setMasterFader(mixerState.master.faderLevel);
    
    if (mixerState.master.multiband) {
      const mbc = mixerState.master.multiband;
      this.setMasterMultiband(mbc.active, mbc.low, mbc.mid, mbc.high);
    }

    mixerState.fxReturns.forEach((fx, index) => {
      this.setFxReturnLevel(index, fx.faderLevel);
    });

    mixerState.matrices.forEach((mtx, index) => {
      this.setMatrixLevel(index, mtx.faderLevel);
    });

    mixerState.channels.forEach(ch => {
      const engineChannel = this.getChannel(ch.id);

      // Restore Soft Patch Routing
      if (ch.source) {
        this.routeInputToChannel(parseInt(ch.source, 10) || ch.id, ch.id);
      }

      this.updateChannelDcaRouting(ch.id, ch.dcaAssignments);
      this.updateChannelMuteRouting(ch.id, ch.muteGroupAssignments);

      this.setChannelFader(ch.id, ch.faderLevel);
      if (typeof engineChannel.setPan === 'function') {
        engineChannel.setPan(ch.pan);
      }

      if (ch.sends) {
        ch.sends.forEach((sendLevel, busIndex) => {
          this.setChannelSendLevel(ch.id, busIndex, sendLevel);
        });
      }

      if (typeof engineChannel.setGate === 'function') {
        engineChannel.setGate(ch.dynamics.gateOn, ch.dynamics.gateThreshold);
      }
      if (typeof engineChannel.setEq === 'function') {
        engineChannel.setEq(ch.eq);
      }
    });

    console.log("🎛️ Audio Engine: DSP Matrix successfully synced to Scene Data.");
  }

}

export const audioEngine = new AudioEngine();