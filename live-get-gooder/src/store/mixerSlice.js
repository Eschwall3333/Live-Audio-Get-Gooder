import { createSlice } from '@reduxjs/toolkit';

const initialChannel = (id) => ({
  id, name: `CH ${id.toString().padStart(2, '0')}`,
  gain: 0, phaseInverted: false, hpfOn: false, hpfFreq: 80,
  eq: { Low: { gain: 0, freq: 100, q: 1.0 }, LowMid: { gain: 0, freq: 400, q: 1.0 }, HighMid: { gain: 0, freq: 2000, q: 1.0 }, High: { gain: 0, freq: 10000, q: 1.0 } },
  dynamics: { gateOn: false, gateThreshold: -60, gateAttack: 10, gateRelease: 100, compOn: false, compThreshold: 0, compRatio: 2, compAttack: 10, compRelease: 100 },
  transport: { hasTrack: false, isPlaying: false },
  sends: Array.from({ length: 16 }, () => -60),
  dcaAssignments: [], 
  // NEW: Mute Group Assignments Array
  muteGroupAssignments: [], 
  faderLevel: 0, mute: false, pan: 0,
});

const initialState = {
  channels: Array.from({ length: 32 }, (_, i) => initialChannel(i + 1)),
  buses: Array.from({ length: 16 }, (_, i) => ({ id: i + 1, name: `BUS ${i+1}`, faderLevel: 0, matrixAssignments: [] })),
  dcas: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `DCA ${i+1}`, faderLevel: 0 })),
  matrices: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: `MTX ${i+1}`, faderLevel: 0 })),
  master: { faderLevel: 0 },
  // NEW: Global Mute Group States (1-6)
  muteGroups: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, active: false }))
};

export const mixerSlice = createSlice({
  name: 'mixer',
  initialState,
  reducers: {
    updateParam: (state, action) => { const { channelId, key, value } = action.payload; const channel = state.channels.find((c) => c.id === channelId); if (channel) channel[key] = value; },
    updateMaster: (state, action) => { state.master.faderLevel = action.payload; },
    updateDcaFader: (state, action) => { state.dcas[action.payload.dcaIndex].faderLevel = action.payload.value; },
    updateMatrixFader: (state, action) => { state.matrices[action.payload.matrixIndex].faderLevel = action.payload.value; },
    
    toggleDcaAssignment: (state, action) => {
      const { channelId, dcaIndex } = action.payload; const ch = state.channels.find(c => c.id === channelId);
      if (ch) { if (ch.dcaAssignments.includes(dcaIndex)) ch.dcaAssignments = ch.dcaAssignments.filter(d => d !== dcaIndex); else ch.dcaAssignments.push(dcaIndex); }
    },
    toggleMatrixAssignment: (state, action) => {
      const { busIndex, matrixIndex } = action.payload; const bus = state.buses[busIndex];
      if (bus) { if (bus.matrixAssignments.includes(matrixIndex)) bus.matrixAssignments = bus.matrixAssignments.filter(m => m !== matrixIndex); else bus.matrixAssignments.push(matrixIndex); }
    },

    // --- NEW: MUTE GROUP REDUCERS ---
    toggleMuteGroupAssignment: (state, action) => {
      const { channelId, muteGroupIndex } = action.payload;
      const ch = state.channels.find(c => c.id === channelId);
      if (ch) {
        if (ch.muteGroupAssignments.includes(muteGroupIndex)) ch.muteGroupAssignments = ch.muteGroupAssignments.filter(m => m !== muteGroupIndex);
        else ch.muteGroupAssignments.push(muteGroupIndex);
      }
    },
    setMuteGroupActive: (state, action) => {
      state.muteGroups[action.payload.muteGroupIndex].active = action.payload.active;
    }
  },
});

export const { updateParam, updateMaster, updateDcaFader, updateMatrixFader, toggleDcaAssignment, toggleMatrixAssignment, toggleMuteGroupAssignment, setMuteGroupActive } = mixerSlice.actions;
export default mixerSlice.reducer;