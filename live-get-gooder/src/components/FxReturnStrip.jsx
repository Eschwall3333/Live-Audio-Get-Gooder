import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateFxReturnFader } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const FxReturnStrip = () => {
  const dispatch = useDispatch();
  const fxReturn = useSelector(state => state.mixer.fxReturns[0]);

  const handleChange = (e) => {
    const val = parseFloat(e.target.value);
    audioEngine.setFxReturnLevel(0, val);
    dispatch(updateFxReturnFader({ fxIndex: 0, value: val }));
  };

  const handleDoubleClick = () => {
    audioEngine.setFxReturnLevel(0, 0);
    dispatch(updateFxReturnFader({ fxIndex: 0, value: 0 }));
  };

  return (
    <div className="channel-strip" style={{ border: '1px solid #17a2b8' }}>
      <div className="scribble-strip" style={{ background: '#17a2b8', color: '#000' }}>
        {fxReturn.name}
      </div>
      
      <div style={{ flex: 1, padding: '10px', minHeight: '150px' }}></div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '300px' }}>
      <input
          /* ... other props ... */
          className="long-throw-fader"
          style={{ height: '250px', width: '30px' }} 
        />
        {/* Converted span to label */}
        <label htmlFor="fx-return-1-fader" style={{ marginTop: '110px', fontWeight: 'bold', color: '#17a2b8', cursor: 'pointer' }}>
          {fxReturn.faderLevel <= -60 ? '-oo' : `${fxReturn.faderLevel} dB`}
        </label>
      </div>
    </div>
  );
};