import { ChannelNodeGroup } from './ChannelNodeGroup';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.channels = new Map();
    this.masterGain = null;
    this.feedbackActive = false;
    this.toneActive = false;
    this.toneGain = null;
    this.toneSource = null; 
    this.globalDcaLevels = Array(8).fill(0); // 8 DCAs starting at 0dB
    this.globalMuteGroups = Array(6).fill(false); // 6 Mute Groups, starting un-muted
  }

 // ... keep imports and constructor ...

 async init() {
  if (this.ctx) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  this.ctx = new AudioContext();
  await this.ctx.audioWorklet.addModule('/noise-gate-processor.js');
  
  // --- MASTER LR ---
  this.masterGain = this.ctx.createGain(); 
  this.masterLimiter = this.ctx.createDynamicsCompressor();
  this.masterLimiter.threshold.value = -3; this.masterLimiter.ratio.value = 20; this.masterLimiter.attack.value = 0.001; this.masterLimiter.release.value = 0.1;
  this.masterFaderGain = this.ctx.createGain(); this.masterFaderGain.gain.value = 1.0; 
  this.masterSplitter = this.ctx.createChannelSplitter(2);
  this.masterAnalyserL = this.ctx.createAnalyser(); this.masterAnalyserR = this.ctx.createAnalyser();
  this.masterAnalyserL.fftSize = 256; this.masterAnalyserR.fftSize = 256;
  
  this.masterGain.connect(this.masterLimiter); this.masterLimiter.connect(this.masterFaderGain);
  this.masterFaderGain.connect(this.masterSplitter);
  this.masterSplitter.connect(this.masterAnalyserL, 0); this.masterSplitter.connect(this.masterAnalyserR, 1); 
  this.masterFaderGain.connect(this.ctx.destination); 
  // --- ADD THIS AT THE BOTTOM OF init() ---
    
    // Dedicated Tone Generator Infrastructure
    this.toneOsc = null;
    this.toneGain = this.ctx.createGain();
    this.toneGain.gain.value = 0; // Starts silent
    this.currentToneDest = this.masterGain; // Defaults to Main LR
    this.toneGain.connect(this.currentToneDest);

  // --- NEW: THE 6 MATRIX MASTERS ---
  this.matrixMasters = [];
  for (let i = 0; i < 6; i++) {
    const mtxGain = this.ctx.createGain();
    mtxGain.gain.value = 1.0; 
    // Matrices output to real physical zones (in our case, the browser speakers)
    mtxGain.connect(this.ctx.destination);
    this.matrixMasters.push(mtxGain);
  }

  // --- MIX BUSES & MATRIX SENDS ---
  this.busMasters = [];
  this.busToMatrixSends = Array(16).fill(null).map(() => Array(6).fill(null)); // 16x6 Patch Bay Grid

  for (let b = 0; b < 16; b++) {
    const busGain = this.ctx.createGain();
    busGain.gain.value = 1.0; 
    this.busMasters.push(busGain);

    // Create a toggleable route from this Bus to all 6 Matrices
    for (let m = 0; m < 6; m++) {
      const sendNode = this.ctx.createGain();
      sendNode.gain.value = 0; // Default Un-Patched (-oo)
      busGain.connect(sendNode);
      sendNode.connect(this.matrixMasters[m]);
      this.busToMatrixSends[b][m] = sendNode;
    }
  }

  // --- CHANNELS ---
  for (let i = 1; i <= 32; i++) {
    const channelNodes = new ChannelNodeGroup(this.ctx);
    channelNodes.outputNode.connect(this.masterGain); 
    for (let b = 0; b < 16; b++) {
      channelNodes.sendNodes[b].connect(this.busMasters[b]);
    }
    this.channels.set(i, channelNodes);
  }
}

// --- NEW MATRIX METHODS ---
updateBusMatrixRouting(busIndex, matrixAssignmentsArray) {
  if (!this.ctx) return;
  for (let m = 0; m < 6; m++) {
    const isPatched = matrixAssignmentsArray.includes(m);
    // Unity gain (1.0) if patched, Silence (0) if un-patched
    this.busToMatrixSends[busIndex][m].gain.setTargetAtTime(isPatched ? 1 : 0, this.ctx.currentTime, 0.01);
  }
}

setMatrixLevel(matrixIndex, db) {
  if (!this.ctx) return;
  const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
  this.matrixMasters[matrixIndex].gain.setTargetAtTime(linear, this.ctx.currentTime, 0.01);
}

// --- NEW: SEND WRAPPER ---
setChannelSendLevel(channelId, busIndex, db) {
  if (!this.ctx) return;
  this.getChannel(channelId).setSendLevel(busIndex, db);
}

// --- CHANNEL FADER WRAPPER (WITH DCA MATH) ---
setChannelFader(channelId, db) {
  if (!this.ctx) return;
  // Passes both the DCA offsets AND the Mute Group Kill States down to the channel
  this.getChannel(channelId).setFader(db, this.globalDcaLevels, this.globalMuteGroups);
}
// --- NEW MASTER OUTPUT CONTROLS ---
setMasterFader(db) {
  if (!this.ctx) return;
  const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
  this.masterFaderGain.gain.setTargetAtTime(linear, this.ctx.currentTime, 0.01);
}

updateChannelMuteRouting(channelId, muteArray) {
  if (!this.ctx) return;
  this.getChannel(channelId).updateMuteAssignments(muteArray);
  this.getChannel(channelId).recalculateDcaGain(this.globalDcaLevels, this.globalMuteGroups);
}

setMuteGroupState(muteGroupIndex, isActive) {
  if (!this.ctx) return;
  this.globalMuteGroups[muteGroupIndex] = isActive;
  
  // Instantly notify every channel to recalculate its mute math
  for (let [id, ch] of this.channels) {
    ch.recalculateDcaGain(this.globalDcaLevels, this.globalMuteGroups);
  }
}

getMasterMeterLevels() {
  // Return safe silent values if context isn't ready or nodes haven't been created
  if (!this.ctx || this.ctx.state !== 'running' || !this.masterAnalyserL || !this.masterAnalyserR) {
    return { l: -80, r: -80 };
  }

  const calcDb = (analyser) => {
    // Safety check: sometimes nodes exist but fftSize is lost on HMR
    if (!analyser.fftSize) return -80; 
    
    const dataArray = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(dataArray);
    
    let sumSquares = 0;
    for (let i = 0; i < dataArray.length; i++) sumSquares += dataArray[i] * dataArray[i];
    const rms = Math.sqrt(sumSquares / dataArray.length);
    let db = 20 * Math.log10(rms);
    return (!isFinite(db) || db < -80) ? -80 : db;
  };

  return {
    l: calcDb(this.masterAnalyserL),
    r: calcDb(this.masterAnalyserR)
  };
}

// ... keep all other existing methods (loadTrack, feedback, tone gen, etc.) ...

  getChannel(id) {
    const ch = this.channels.get(id);
    if (!ch) throw new Error(`Audio Channel ${id} not initialized.`);
    return ch;
  }

  // ==========================================
  // TONE GENERATOR ROUTING & CONTROL
  // ==========================================
  
  setToneRouting(destType, destId) {
    if (!this.ctx || !this.toneGain) return;
    
    // Unplug the virtual patch cable
    this.toneGain.disconnect();

    // Plug it into the new destination
    if (destType === 'MAIN') {
      this.currentToneDest = this.masterGain;
    } else if (destType === 'CH') {
      // Patches directly into the top of the channel strip (Pre-HPF, Pre-EQ, Pre-Fader)
      this.currentToneDest = this.getChannel(destId).inputNode;
    } else if (destType === 'BUS') {
      this.currentToneDest = this.busMasters[destId - 1]; // Array is 0-indexed
    }

    this.toneGain.connect(this.currentToneDest);
  }

  playTone(freq, type = 'sine') {
    if (!this.ctx) return;
    if (this.toneOsc) this.toneOsc.stop(); // Kill existing tone if playing
    
    this.toneOsc = this.ctx.createOscillator();
    this.toneOsc.type = type;
    this.toneOsc.frequency.value = freq;
    this.toneOsc.connect(this.toneGain);
    this.toneOsc.start();
  }

  stopTone() {
    if (this.toneOsc) {
      this.toneOsc.stop();
      this.toneOsc.disconnect();
      this.toneOsc = null;
    }
  }

  setToneLevel(db) {
    if (!this.ctx || !this.toneGain) return;
    const linear = db <= -60 ? 0 : Math.pow(10, db / 20);
    this.toneGain.gain.setTargetAtTime(linear, this.ctx.currentTime, 0.01);
  }

  // --- TAPE MACHINE WRAPPERS ---
  loadTrackIntoChannel(id, audioBuffer) {
    if (!this.ctx) return;
    this.getChannel(id).loadTrack(audioBuffer);
  }

  playChannelTrack(id) {
    this.getChannel(id).playTrack();
  }

  pauseChannelTrack(id) {
    this.getChannel(id).pauseTrack();
  }

  stopChannelTrack(id) {
    this.getChannel(id).stopTrack();
  }

  updateChannelDcaRouting(channelId, dcaArray) {
    if (!this.ctx) return;
    this.getChannel(channelId).updateDcaAssignments(dcaArray);
    // Force a volume recalculation immediately
    this.getChannel(channelId).recalculateDcaGain(this.globalDcaLevels);
  }

  setDcaLevel(dcaIndex, db) {
    if (!this.ctx) return;
    this.globalDcaLevels[dcaIndex] = db;
    
    // When a DCA moves, tell EVERY channel to recalculate its math
    for (let [id, ch] of this.channels) {
      ch.recalculateDcaGain(this.globalDcaLevels);
    }
  }



  // --- THE FEEDBACK SIMULATOR ---
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
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.0001; 
    }
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
  startTone(type = 'sine', freq = 1000, levelDb = -18) {
    if (!this.ctx) return;
    this.stopTone(); // Kill any existing tone

    this.toneGain = this.ctx.createGain();
    this.toneGain.gain.value = Math.pow(10, levelDb / 20);
    this.toneGain.connect(this.masterLimiter); // Route directly to master out

    if (type === 'pink' || type === 'white') {
      // Build a White Noise Buffer
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      
      for (let i = 0; i < bufferSize; i++) {
        // Simple white noise generation
        output[i] = Math.random() * 2 - 1;
      }
      
      this.toneSource = this.ctx.createBufferSource();
      this.toneSource.buffer = noiseBuffer;
      this.toneSource.loop = true;
    } else {
      // Build a Sine Wave Oscillator
      this.toneSource = this.ctx.createOscillator();
      this.toneSource.type = 'sine';
      this.toneSource.frequency.value = freq;
    }

    this.toneSource.connect(this.toneGain);
    this.toneSource.start();
    this.toneActive = true;
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
}

export const audioEngine = new AudioEngine();