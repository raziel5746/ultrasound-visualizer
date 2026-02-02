import React, { useState, useRef, useCallback, Suspense, useEffect } from 'react';
import './App.css';
import { FaFileUpload } from 'react-icons/fa';
import ConversionPrompt from './components/ConversionPrompt';

const UltrasoundVisualizer = React.lazy(() => import('./UltrasoundVisualizer'));

function App() {
  const [videoUrl, setVideoUrl] = useState(null);
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);
  const fileInputRef = useRef(null);
  const [isRotationLocked, setIsRotationLocked] = useState(false);
  const [showConversionPrompt, setShowConversionPrompt] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Clear the previous video URL first
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      
      // Store the file for potential conversion
      setPendingFile(file);
      setError(null);
      
      // Create new URL and set it
      const newUrl = URL.createObjectURL(file);
      setVideoUrl(newUrl);
      setFileName(file.name);
    }
  };

  const handleError = useCallback((errorMessage) => {
    // Check if it's an unsupported format error
    if (errorMessage && errorMessage.includes('not supported') && pendingFile) {
      setShowConversionPrompt(true);
    } else {
      setError(errorMessage);
    }
  }, [pendingFile]);

  const handleConversionComplete = useCallback((convertedBlob) => {
    setShowConversionPrompt(false);
    
    // Revoke old URL
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    
    // Create new URL from converted blob
    const newUrl = URL.createObjectURL(convertedBlob);
    setVideoUrl(newUrl);
    setError(null);
  }, [videoUrl]);

  const handleConversionCancel = useCallback(() => {
    setShowConversionPrompt(false);
    setError('Video format not supported. Please convert to H.264/MP4 format.');
  }, []);

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
        await window.screen.orientation.lock(window.screen.orientation.type);
      } else {
        // Unlock orientation
        await window.screen.orientation.unlock();
      }
      setIsRotationLocked(locked);
    } catch (err) {
      console.warn('Screen Orientation API not supported:', err);
    }
  };

  useEffect(() => {
    const checkOrientationSupport = async () => {
      try {
        if (!window.screen.orientation) {
          console.warn('Screen Orientation API not supported');
          return;
        }
        // Get initial lock state (if any)
        const isLocked = window.screen.orientation.type.includes('locked');
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
                setError={handleError}
                onFileSelect={handleChooseFile}
                setVideoUrl={setVideoUrl}
                isRotationLocked={isRotationLocked}
                onRotationLockChange={handleRotationLockChange}
              />
            </Suspense>
          </>
        )}
        
        {showConversionPrompt && pendingFile && (
          <ConversionPrompt
            file={pendingFile}
            onConversionComplete={handleConversionComplete}
            onCancel={handleConversionCancel}
          />
        )}
      </main>
    </div>
  );
}

export default App;
