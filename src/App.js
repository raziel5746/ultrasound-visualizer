import React, { useState, useRef, useCallback, Suspense, useEffect } from 'react';
import './App.css';
import { FaFileUpload } from 'react-icons/fa';

const UltrasoundVisualizer = React.lazy(() => import('./UltrasoundVisualizer'));

function App() {
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const fileInputRef = useRef(null);
  const [isRotationLocked, setIsRotationLocked] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Clear the previous video URL first
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      
      // Create new URL and set it
      const newUrl = URL.createObjectURL(file);
      setVideoUrl(newUrl);
      setFileName(file.name);
    }
  };

  const handleChooseFile = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error('File input reference is null');
    }
  }, []);

  const handleRotationLockChange = async (locked) => {
    try {
      if (locked) {
        // Lock to current orientation
        await screen.orientation.lock(screen.orientation.type);
      } else {
        // Unlock orientation
        await screen.orientation.unlock();
      }
      setIsRotationLocked(locked);
    } catch (err) {
      console.warn('Screen Orientation API not supported:', err);
    }
  };

  useEffect(() => {
    const checkOrientationSupport = async () => {
      try {
        if (!screen.orientation) {
          console.warn('Screen Orientation API not supported');
          return;
        }
        // Get initial lock state (if any)
        const isLocked = screen.orientation.type.includes('locked');
        setIsRotationLocked(isLocked);
      } catch (err) {
        console.warn('Error checking orientation support:', err);
      }
    };

    checkOrientationSupport();
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
            <Suspense fallback={<div>Loading...</div>}>
              <UltrasoundVisualizer
                videoUrl={videoUrl}
                fileName={fileName}
                setError={setError}
                onFileSelect={handleChooseFile}
                setVideoUrl={setVideoUrl}
                isRotationLocked={isRotationLocked}
                onRotationLockChange={handleRotationLockChange}
              />
            </Suspense>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
