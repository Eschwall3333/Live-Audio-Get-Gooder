import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateMaster } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const MasterStrip = () => {
  const dispatch = useDispatch();
  const initialVolume = useSelector(state => state.mixer.master.faderLevel);
  const [val, setVal] = useState(initialVolume);
  
  const fillLRef = useRef(null);
  const fillRRef = useRef(null);
  const reqRef = useRef();

  const handleChange = (e) => {
    const numericVal = parseFloat(e.target.value);
    setVal(numericVal);
    audioEngine.setMasterFader(numericVal);
  };

  const handleRelease = () => {
    dispatch(updateMaster(val));
  };

  const handleDoubleClick = () => {
    setVal(0);
    audioEngine.setDcaLevel(dcaIndex, 0);
    dispatch(updateDcaFader({ dcaIndex, value: 0 }));
  };

  // Dual L/R Meter Animation Loop
  useEffect(() => {
    const updateMeters = () => {
      if (audioEngine.ctx && audioEngine.ctx.state === 'running') {
        const { l, r } = audioEngine.getMasterMeterLevels();

        const applyStyle = (ref, db) => {
          let percent = ((db + 60) / 60) * 100;
          if (percent < 0) percent = 0;
          if (percent > 100) percent = 100;
          
          if (ref.current) {
            ref.current.style.height = `${percent}%`;
            if (db > -3) ref.current.style.background = '#d9534f';
            else if (db > -18) ref.current.style.background = '#f0ad4e';
            else ref.current.style.background = '#5cb85c';
          }
        };

        applyStyle(fillLRef, l);
        applyStyle(fillRRef, r);
      }
      reqRef.current = requestAnimationFrame(updateMeters);
    };

    reqRef.current = requestAnimationFrame(updateMeters);
    return () => cancelAnimationFrame(reqRef.current);
  }, []);

  return (
    <div className="channel-strip" style={{ background: '#252529', border: '1px solid #444', minWidth: '180px' }}>
      <div className="scribble-strip" style={{ background: '#fff' }}>MASTER LR</div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
        <div className="module-header" style={{ marginBottom: '50px' }}>MAIN OUTPUT</div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%', justifyContent: 'center' }}>
          
          {/* Main Fader */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '300px' }}>
          <input 
              type="range" min="-60" max="10" step="0.5" 
              value={val} onChange={handleChange} onMouseUp={handleRelease} onTouchEnd={handleRelease}
              className="long-throw-fader" style={{ width: '200px' }} 
              id="fader-master"
              name="fader-master"
              aria-label="Master LR Output Volume"
             
          // ... other props ...
              onDoubleClick={handleDoubleClick}
                                      />
        
            <span style={{ marginTop: '110px', fontWeight: 'bold' }}>{val <= -60 ? '-oo' : `${val} dB`}</span>
          </div>
          
          {/* Dual L/R Meters */}
          <div style={{ display: 'flex', gap: '2px', height: '300px', marginTop: '120px' }}>
            <div style={{ width: '8px', height: '100%', background: '#111', borderRadius: '2px', position: 'relative', overflow: 'hidden', border: '1px solid #333' }}>
              <div ref={fillLRef} style={{ position: 'absolute', bottom: 0, width: '100%', transition: 'height 0.05s linear' }} />
            </div>
            <div style={{ width: '8px', height: '100%', background: '#111', borderRadius: '2px', position: 'relative', overflow: 'hidden', border: '1px solid #333' }}>
              <div ref={fillRRef} style={{ position: 'absolute', bottom: 0, width: '100%', transition: 'height 0.05s linear' }} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};