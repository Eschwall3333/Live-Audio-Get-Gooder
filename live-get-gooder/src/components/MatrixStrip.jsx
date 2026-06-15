import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateMatrixFader } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const MatrixStrip = ({ matrixIndex }) => {
  const dispatch = useDispatch();
  const matrix = useSelector(state => state.mixer.matrices[matrixIndex]);
  const [val, setVal] = useState(matrix.faderLevel);

  const handleChange = (e) => {
    const numericVal = parseFloat(e.target.value);
    setVal(numericVal);
    audioEngine.setMatrixLevel(matrixIndex, numericVal);
  };

  const handleRelease = () => {
    dispatch(updateMatrixFader({ matrixIndex, value: val }));
  };

  const handleDoubleClick = () => {
    setVal(0);
    audioEngine.setDcaLevel(dcaIndex, 0);
    dispatch(updateDcaFader({ dcaIndex, value: 0 }));
  };

  return (
    <div className="channel-strip" style={{ minWidth: '80px', background: '#221e22', border: '1px solid #444' }}>
      
      {/* MAGENTA SCRIBBLE STRIP */}
      <div className="scribble-strip" style={{ background: '#ff00ff', color: '#000', fontSize: '1rem', padding: '10px 0' }}>
        {matrix.name}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '300px', marginTop: 'auto' }}>
        
        <label htmlFor={`fader-matrix-${matrixIndex}`} className="sr-only">
          Volume for Matrix {matrixIndex + 1}
        </label>
        
        <input 
          id={`fader-matrix-${matrixIndex}`}
          name={`fader-matrix-${matrixIndex}`}
          type="range" min="-60" max="10" step="0.5" 
          value={val} onChange={handleChange} onMouseUp={handleRelease} onTouchEnd={handleRelease}
          className="long-throw-fader" style={{ width: '200px' }} 
          onDoubleClick={handleDoubleClick}
        />
        
        <span style={{ marginTop: '110px', fontWeight: 'bold', fontSize: '0.8rem', color: '#ff00ff' }}>
          {val <= -60 ? '-oo' : `${val} dB`}
        </span>
      </div>
    </div>
  );
};