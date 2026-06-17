import { createSlice } from '@reduxjs/toolkit';

// Helper function to build the 32 input channels
const generateChannels = () => {
  const channels = [];
  for (let i = 1; i <= 32; i++) {
    channels.push({
      id: i,
      name: `CH ${i < 10 ? '0'+i : i}`,
      faderLevel: -80,
      pan: 0,
      sends: Array(16).fill(-80), 
      muteGroupAssignments: [],
      dcaAssignments: [],
      dynamics: { gateOn: false, gateThreshold: -80 },
      eq: {
        low: { freq: 80, gain: 0, q: 1.0 },
        lowMid: { freq: 400, gain: 0, q: 1.0 },
        highMid: { freq: 2000, gain: 0, q: 1.0 },
        high: { freq: 8000, gain: 0, q: 1.0 }
      }
    });
  }
  return channels;
};

// The initial state of the console
const initialState = {
  selectedChannelId: 1, 
  channels: generateChannels(),
  master: {
    faderLevel: 0, // <--- FIX: Master LR defaults to Unity Gain (0dB)
    multiband: {
      active: false,
      low: { thresh: 0, ratio: 1, gain: 0 },
      mid: { thresh: 0, ratio: 1, gain: 0 },
      high: { thresh: 0, ratio: 1, gain: 0 }
    }
  },
  fxReturns: [{ id: 1, name: 'FX 1 REV', faderLevel: -80 }],
  dcas: Array(8).fill(null).map((_, i) => ({ id: i+1, name: `DCA ${i+1}`, faderLevel: 0 })),
  muteGroups: Array(6).fill(null).map((_, i) => ({ id: i+1, name: `MUTE ${i+1}`, active: false })),
  matrices: Array(6).fill(null).map((_, i) => ({ id: i+1, name: `MTX ${i+1}`, faderLevel: -80 }))
};

export const mixerSlice = createSlice({
  name: 'mixer',
  initialState,
  reducers: {
    updateParam: (state, action) => {
      const { channelId, key, value } = action.payload;
      const channel = state.channels.find(ch => ch.id === channelId);
      if (channel) channel[key] = value;
    },
    selectChannel: (state, action) => {
      state.selectedChannelId = action.payload;
    },
    updateChannelSend: (state, action) => {
      const { channelId, busIndex, value } = action.payload;
      const channel = state.channels.find(ch => ch.id === channelId);
      if (channel && channel.sends) {
        channel.sends[busIndex] = value;
      }
    },
    updateChannelEq: (state, action) => {
      const { channelId, band, param, value } = action.payload;
      const channel = state.channels.find(ch => ch.id === channelId);
      if (channel && channel.eq) {
        channel.eq[band][param] = value;
      }
    },
    updateMasterMultiband: (state, action) => {
      const { band, param, value } = action.payload;
      if (band === 'active') {
        state.master.multiband.active = value;
      } else if (state.master.multiband[band]) {
        state.master.multiband[band][param] = value;
      }
    },
    updateFxReturnFader: (state, action) => {
      const { id, value } = action.payload;
      const fx = state.fxReturns.find(f => f.id === id);
      if (fx) fx.faderLevel = value;
    },
    updateMaster: (state, action) => {
      if (typeof action.payload === 'object' && action.payload.value !== undefined) {
        state.master.faderLevel = action.payload.value;
      } else {
        state.master.faderLevel = action.payload;
      }
    },
    loadScene: (state, action) => {
      return action.payload;
    }
  }
});

export const { 
  updateParam, 
  selectChannel, 
  updateChannelSend, 
  updateChannelEq, 
  updateMasterMultiband,
  updateFxReturnFader,
  updateMaster, 
  loadScene 
} = mixerSlice.actions;

export default mixerSlice.reducer;