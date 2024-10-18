import React, { useState } from 'react';
import './App.css';
import UltrasoundVisualizer from './UltrasoundVisualizer';

function App() {
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setVideoUrl(URL.createObjectURL(file));
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Ultrasound Visualizer</h1>
        <input type="file" accept="video/*" onChange={handleFileUpload} />
      </header>
      <main className="App-main">
        {error && <p className="error">{error}</p>}
        {videoUrl && (
          <UltrasoundVisualizer
            videoUrl={videoUrl}
            setError={setError}
          />
        )}
      </main>
    </div>
  );
}

export default App;
