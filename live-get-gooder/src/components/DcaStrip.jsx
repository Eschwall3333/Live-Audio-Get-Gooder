import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateDcaFader } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const DcaStrip = ({ dcaIndex }) => {
  const dispatch = useDispatch();
  const dca = useSelector(state => state.mixer.dcas[dcaIndex]);
  const [val, setVal] = useState(dca.faderLevel);

  const handleChange = (e) => {
    const numericVal = parseFloat(e.target.value);
    setVal(numericVal);
    // Send the math update to the audio engine immediately
    audioEngine.setDcaLevel(dcaIndex, numericVal);
  };

  const handleRelease = () => {
    // Save the final fader resting place to Redux
    dispatch(updateDcaFader({ dcaIndex, value: val }));
  };

  const handleDoubleClick = () => {
    setVal(0);
    audioEngine.setDcaLevel(dcaIndex, 0);
    dispatch(updateDcaFader({ dcaIndex, value: 0 }));
  };

  return (
    <div className="channel-strip" style={{ minWidth: '80px', background: '#1c1c1f' }}>
      <div className="scribble-strip" style={{ background: '#555', color: '#fff', fontSize: '1rem', padding: '10px 0' }}>
        {dca.name}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '300px', marginTop: 'auto' }}>
      <input 
          type="range" min="-60" max="10" step="0.5" 
          value={val} onChange={handleChange} onMouseUp={handleRelease} onTouchEnd={handleRelease}
          className="long-throw-fader" style={{ width: '200px' }} 
          id={`fader-dca-${dcaIndex}`}
          name={`fader-dca-${dcaIndex}`}
          onDoubleClick={handleDoubleClick}
          aria-label={`Volume offset for DCA ${dcaIndex + 1}`}
        />
        <span style={{ marginTop: '110px', fontWeight: 'bold', fontSize: '0.8rem', color: '#888' }}>
          {val <= -60 ? '-oo' : `${val} dB`}
        </span>
      </div>
    </div>
  );
};