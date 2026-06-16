import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateMaster } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const MasterStrip = () => {
  const dispatch = useDispatch();
  const faderLevel = useSelector((state) => state.mixer.master.faderLevel);

  const handleFaderChange = (e) => {
    const val = parseFloat(e.target.value);
    dispatch(updateMaster(val));
    audioEngine.setMasterFader(val);
  };

  const handleDoubleClick = () => {
    dispatch(updateMaster(0));
    audioEngine.setMasterFader(0);
  };

  return (
    <div className="channel-strip" style={{ border: '1px solid #dc3545' }}>
      <div className="scribble-strip" style={{ background: '#dc3545', color: '#fff' }}>
        MAIN LR
      </div>

      <div style={{ flex: 1, padding: '10px', minHeight: '150px' }}></div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '300px' }}>
      <input
          /* ... other props ... */
          className="long-throw-fader"
          style={{ height: '250px', width: '30px' }} 
        />
        {/* Converted span to label */}
        <label htmlFor="master-fader" style={{ marginTop: '110px', fontWeight: 'bold', color: '#dc3545', cursor: 'pointer' }}>
          {faderLevel <= -60 ? '-oo' : `${faderLevel} dB`}
        </label>
      </div>
    </div>
  );
};