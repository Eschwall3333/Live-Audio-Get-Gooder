import { configureStore } from '@reduxjs/toolkit';
import mixerReducer from './mixerSlice';

export const store = configureStore({
  reducer: {
    mixer: mixerReducer,
  },
});