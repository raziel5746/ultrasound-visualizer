import React, { useState, useRef, useCallback } from 'react';
import './App.css';
import UltrasoundVisualizer from './UltrasoundVisualizer';
import { FaFileUpload } from 'react-icons/fa';

function App() {
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Clear the previous video URL first
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      // Create new URL and set it
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
            <h1>Ultrasound Visualizer</h1>
            <p>Upload a video file to begin your 3D ultrasound visualization experience.</p>
            <button onClick={handleChooseFile} className="choose-file-btn">
              <FaFileUpload style={{ marginRight: '10px' }} />
              Select Video File
            </button>
          </div>
        ) : (
          <>
            {error && <p className="error">{error}</p>}
            <UltrasoundVisualizer
              videoUrl={videoUrl}
              setError={setError}
              onFileSelect={handleChooseFile}
              setVideoUrl={setVideoUrl}
            />
          </>
        )}
      </main>
    </div>
  );
}

export default App;
