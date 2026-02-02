import React, { useState } from 'react';
import { getVideoConverter } from '../utils/VideoConverter';

const ConversionPrompt = ({ 
  file,
  onConversionComplete,
  onCancel 
}) => {
  const [status, setStatus] = useState('prompt'); // 'prompt', 'loading', 'converting', 'error'
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [ffmpegStatus, setFfmpegStatus] = useState('');
  const [error, setError] = useState(null);

  const handleConvert = async () => {
    try {
      setStatus('loading');
      setLoadingMessage('Loading video converter (first time may take 30+ seconds)...');
      
      const converter = getVideoConverter();
      
      // Set up log listener to parse progress from FFmpeg output
      converter.onLog = (message) => {
        // Parse frame progress from FFmpeg output like "frame=  100 fps=..."
        const frameMatch = message.match(/frame=\s*(\d+)/);
        const timeMatch = message.match(/time=(\d+:\d+:\d+\.\d+)/);
        if (frameMatch || timeMatch) {
          const info = [];
          if (frameMatch) info.push(`Frame ${frameMatch[1]}`);
          if (timeMatch) info.push(`Time: ${timeMatch[1]}`);
          setFfmpegStatus(info.join(' | '));
        }
      };
      
      await converter.load();
      
      setStatus('converting');
      setLoadingMessage('Converting video (WebAssembly encoding is slow, please wait)...');
      
      const convertedBlob = await converter.convertToH264(file, (p) => {
        if (p > 0) setProgress(Math.round(p * 100));
      });
      
      onConversionComplete(convertedBlob);
    } catch (err) {
      console.error('Conversion error:', err);
      const errorMsg = err.message || err.toString() || 'Unknown error occurred';
      // Check for mobile memory issues
      if (errorMsg.includes('Out of memory') || errorMsg.includes('RangeError')) {
        setError('Out of memory - mobile browsers have limited memory for video conversion. Please try on a desktop browser or convert the video externally.');
      } else {
        setError(errorMsg);
      }
      setStatus('error');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '12px',
        padding: '30px',
        maxWidth: '500px',
        width: '90%',
        textAlign: 'center',
        border: '1px solid #404040',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
      }}>
        {status === 'prompt' && (
          <>
            <h2 style={{ color: '#fff', marginTop: 0, marginBottom: '15px' }}>
              Video Format Not Supported
            </h2>
            <p style={{ color: '#a0aec0', marginBottom: '25px', lineHeight: '1.6' }}>
              This video uses a codec your browser can't play directly (likely HEVC/H.265).
              <br /><br />
              Would you like to convert it to a compatible format? This happens entirely in your browser - no upload required.
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={handleConvert}
                style={{
                  padding: '12px 30px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Convert Video
              </button>
              <button
                onClick={onCancel}
                style={{
                  padding: '12px 30px',
                  backgroundColor: 'transparent',
                  color: '#a0aec0',
                  border: '1px solid #404040',
                  borderRadius: '6px',
                  fontSize: '16px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {(status === 'loading' || status === 'converting') && (
          <>
            <h2 style={{ color: '#fff', marginTop: 0, marginBottom: '15px' }}>
              {status === 'loading' ? 'Preparing Converter' : 'Converting Video'}
            </h2>
            <p style={{ color: '#a0aec0', marginBottom: '20px' }}>
              {loadingMessage}
            </p>
            {status === 'converting' && (
              <>
                {progress > 0 && (
                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#333',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    marginBottom: '10px',
                  }}>
                    <div style={{
                      width: `${progress}%`,
                      height: '100%',
                      backgroundColor: '#3498db',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                )}
                {ffmpegStatus && (
                  <p style={{ color: '#3498db', fontWeight: 'bold', fontFamily: 'monospace' }}>
                    {ffmpegStatus}
                  </p>
                )}
                {!ffmpegStatus && (
                  <p style={{ color: '#666', fontSize: '14px' }}>
                    Starting conversion...
                  </p>
                )}
              </>
            )}
            {status === 'loading' && (
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid #333',
                borderTopColor: '#3498db',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '20px auto',
              }} />
            )}
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </>
        )}

        {status === 'error' && (
          <>
            <h2 style={{ color: '#e74c3c', marginTop: 0, marginBottom: '15px' }}>
              Conversion Failed
            </h2>
            <p style={{ color: '#a0aec0', marginBottom: '25px' }}>
              {error || 'An error occurred during conversion.'}
            </p>
            <button
              onClick={onCancel}
              style={{
                padding: '12px 30px',
                backgroundColor: '#333',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ConversionPrompt;
