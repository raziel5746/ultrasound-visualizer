import React from 'react';

const LoadingScreen = ({ 
  extractionProgress, 
  totalFrames, 
  videoInfo 
}) => {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      color: 'white',
      fontSize: '24px',
      zIndex: 1000
    }}>
      <div style={{ marginBottom: '20px' }}>Extracting Frames</div>
      <div style={{ 
        width: '80%', 
        height: '40px', 
        backgroundColor: '#444',
        borderRadius: '20px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${extractionProgress * 100}%`,
          height: '100%',
          backgroundColor: '#3498db',
        }} />
      </div>
      <div style={{ marginTop: '10px' }}>
        {Math.round(extractionProgress * 100)}% ({Math.round(extractionProgress * totalFrames)} / {totalFrames} frames)
      </div>
      
      {videoInfo.originalWidth > 0 && (
        <div style={{
          marginTop: '20px',
          fontSize: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: '15px',
          borderRadius: '10px',
          gap: '5px'
        }}>
          <div>Original: {videoInfo.originalWidth}×{videoInfo.originalHeight}</div>
          <div>Scaled: {videoInfo.scaledWidth}×{videoInfo.scaledHeight}</div>
          <div>Scale factor: {videoInfo.scaleFactor}x</div>
        </div>
      )}
    </div>
  );
};

export default LoadingScreen;
