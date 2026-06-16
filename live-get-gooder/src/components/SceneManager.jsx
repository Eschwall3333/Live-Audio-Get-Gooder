import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { loadScene } from '../store/mixerSlice';
import { audioEngine } from '../audio/AudioEngine';

export const SceneManager = () => {
    const dispatch = useDispatch();
    const fullMixerState = useSelector((state) => state.mixer);
    const [savedScenes, setSavedScenes] = useState([]);
    const [sceneName, setSceneName] = useState('');

  // Boot up: Check local hard drive for saved shows
  useEffect(() => {
    const scenes = JSON.parse(localStorage.getItem('m32_scenes')) || [];
    setSavedScenes(scenes);
  }, []);

  const handleSave = () => {
    if (!sceneName.trim()) return alert("Name your scene first.");
    
    const newScene = {
      id: Date.now(),
      name: sceneName,
      timestamp: new Date().toLocaleString(),
      state: fullMixerState // The entire Redux tree
    };

    const updatedScenes = [...savedScenes, newScene];
    localStorage.setItem('m32_scenes', JSON.stringify(updatedScenes));
    setSavedScenes(updatedScenes);
    setSceneName('');
  };

  const handleRecall = (scene) => {
    if (window.confirm(`Recall scene: ${scene.name}? This will overwrite your current mix.`)) {
     // 1. Update the React UI (Redux)
     dispatch(loadScene(scene.state));
      
     // 2. Push the data into the C++ DSP Math (Web Audio API)
     audioEngine.syncToState(scene.state);
    }
  };

  const handleDelete = (id) => {
    const updatedScenes = savedScenes.filter(s => s.id !== id);
    localStorage.setItem('m32_scenes', JSON.stringify(updatedScenes));
    setSavedScenes(updatedScenes);
  };

  return (
    <div style={{ padding: '15px', background: '#1c1c1f', border: '1px solid #444', borderRadius: '6px', marginBottom: '15px' }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#17a2b8', fontSize: '14px', letterSpacing: '1px' }}>SHOW CONTROL</h3>
      
      {/* SAVE BAR */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '15px' }}>
        <input 
          type="text" value={sceneName} onChange={(e) => setSceneName(e.target.value)} 
          placeholder="New Scene Name..." 
          style={{ flex: 1, padding: '5px', background: '#000', color: '#fff', border: '1px solid #333' }}
        />
        <button onClick={handleSave} style={{ background: '#17a2b8', color: '#000', border: 'none', padding: '5px 15px', fontWeight: 'bold', cursor: 'pointer' }}>
          SAVE
        </button>
      </div>

      {/* RECALL LIST */}
      <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
        {savedScenes.length === 0 ? <span style={{ fontSize: '12px', color: '#666' }}>No scenes saved on this device.</span> : null}
        
        {savedScenes.map(scene => (
          <div key={scene.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px', borderBottom: '1px solid #333', fontSize: '12px' }}>
            <span style={{ cursor: 'pointer', color: '#fff' }} onClick={() => handleRecall(scene)}>
              ▶ {scene.name} <span style={{ color: '#666', fontSize: '10px' }}>({scene.timestamp})</span>
            </span>
            <button onClick={() => handleDelete(scene.id)} style={{ background: 'transparent', border: 'none', color: '#dc3545', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
};