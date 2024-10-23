import React, { useState, useRef, useCallback } from 'react';
import './App.css';
import UltrasoundVisualizer from './UltrasoundVisualizer';

function App() {
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setVideoUrl(URL.createObjectURL(file));
    }
  };

  const handleChooseFile = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error('File input reference is null');
    }
  }, []);

  return (
    <div className="App">
      <main className="App-main">
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="video/*"
          onChange={handleFileUpload}
        />
        {!videoUrl ? (
          <div className="welcome-screen">
            <h2>Welcome to Ultrasound Visualizer</h2>
            <p>Please choose a video file to begin.</p>
            <button onClick={handleChooseFile} className="choose-file-btn">
              Choose File
            </button>
          </div>
        ) : (
          <>
            {error && <p className="error">{error}</p>}
            <UltrasoundVisualizer
              videoUrl={videoUrl}
              setError={setError}
              onFileSelect={handleChooseFile}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
