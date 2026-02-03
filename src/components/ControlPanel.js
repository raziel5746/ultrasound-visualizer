import React, { useState, useEffect, useRef } from 'react';
import { FaLayerGroup, FaImages, FaEye, FaSun, FaPalette, FaArrowsAltH, FaLightbulb, FaAdjust, FaLock, FaLockOpen, FaCube, FaCircle } from 'react-icons/fa';
import * as BABYLON from '@babylonjs/core';
import { Range, getTrackBackground } from 'react-range';
import { getColorMapNames, ColorMaps } from '../utils/ColorMaps';
import SliceControl from './SliceControl';

const ControlItem = ({ icon, label, value, min, max, step, onChange, unit = '', convertValue, displayValue, onImmediateChange, isMobile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const rafId = useRef(null);
  const pendingValue = useRef(null);
  
  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  // Only update local value from props when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const scheduleUpdate = (newValue) => {
    pendingValue.current = newValue;
    
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(() => {
        if (pendingValue.current !== null) {
          onChange(pendingValue.current);
          if (onImmediateChange) {
            onImmediateChange(pendingValue.current);
          }
          pendingValue.current = null;
        }
        rafId.current = null;
      });
    }
  };

  const handleChange = (e) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);
    scheduleUpdate(newValue);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    // Ensure final value is applied
    if (pendingValue.current !== null) {
      onChange(pendingValue.current);
      if (onImmediateChange) {
        onImmediateChange(pendingValue.current);
      }
      pendingValue.current = null;
    }
  };

  return (
    <div style={{ 
      marginBottom: isMobile ? '15px' : '20px',
      opacity: isDragging ? 1 : 0.9,
      transition: 'opacity 0.2s ease'
    }}>
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '8px',
        fontSize: isMobile ? '14px' : '16px',
        fontWeight: '500',
        color: '#ffffff',
        opacity: 0.9
      }}>
        {icon && <span style={{ marginRight: '10px', color: '#ffffff' }}>{icon}</span>}
        {label}:
      </label>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue}
          onChange={handleChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={handleDragEnd}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={handleDragEnd}
          onMouseLeave={handleDragEnd}
          style={{ flex: 1, marginRight: isMobile ? 0 : '10px' }}
        />
        {!isMobile && (
          <span style={{ minWidth: '50px', textAlign: 'right', fontSize: '16px' }}>
            {(displayValue || ((v) => v.toFixed(2)))(convertValue ? convertValue(localValue) : localValue)}{unit}
          </span>
        )}
      </div>
    </div>
  );
};

// Dual-handle range slider with draggable middle section for volume clipping
const VolumeClipSlider = ({ label, values, onChange, isMobile }) => {
  const containerRef = useRef(null);
  const [isDraggingMiddle, setIsDraggingMiddle] = useState(false);
  const dragStartRef = useRef({ x: 0, values: [0, 1] });
  
  const handleMiddleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingMiddle(true);
    dragStartRef.current = {
      x: e.clientX || e.touches?.[0]?.clientX || 0,
      values: [...values]
    };
  };
  
  useEffect(() => {
    if (!isDraggingMiddle) return;
    
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
      const rect = containerRef.current.getBoundingClientRect();
      const deltaX = clientX - dragStartRef.current.x;
      const deltaPercent = deltaX / rect.width;
      
      const rangeSize = dragStartRef.current.values[1] - dragStartRef.current.values[0];
      let newMin = dragStartRef.current.values[0] + deltaPercent;
      let newMax = dragStartRef.current.values[1] + deltaPercent;
      
      if (newMin < 0) { newMin = 0; newMax = rangeSize; }
      if (newMax > 1) { newMax = 1; newMin = 1 - rangeSize; }
      
      onChange([Math.max(0, Math.min(1, newMin)), Math.max(0, Math.min(1, newMax))]);
    };
    
    const handleMouseUp = () => setIsDraggingMiddle(false);
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDraggingMiddle, onChange]);
  
  // Calculate center position for the third handle
  const centerPosition = (values[0] + values[1]) / 2;
  
  return (
    <div ref={containerRef} style={{ marginBottom: '12px', paddingBottom: '32px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: isMobile ? '12px' : '13px', color: '#aaa' }}>{label}</span>
        <span style={{ fontSize: '11px', color: '#666' }}>
          {values[0].toFixed(2)} - {values[1].toFixed(2)}
        </span>
      </div>
      <Range
        values={values}
        step={0.01}
        min={0}
        max={1}
        onChange={onChange}
        renderTrack={({ props, children }) => (
          <div
            onMouseDown={props.onMouseDown}
            onTouchStart={props.onTouchStart}
            style={{
              ...props.style,
              height: '28px',
              display: 'flex',
              width: '100%'
            }}
          >
            <div
              ref={props.ref}
              style={{
                height: '8px',
                width: '100%',
                borderRadius: '4px',
                background: getTrackBackground({
                  values,
                  colors: ['#222', '#3498db', '#222'],
                  min: 0,
                  max: 1
                }),
                alignSelf: 'center',
                position: 'relative'
              }}
            >
              {/* Draggable middle section */}
              <div
                onMouseDown={handleMiddleMouseDown}
                onTouchStart={handleMiddleMouseDown}
                style={{
                  position: 'absolute',
                  left: `${values[0] * 100}%`,
                  width: `${(values[1] - values[0]) * 100}%`,
                  height: '100%',
                  cursor: 'grab',
                  borderRadius: '4px',
                }}
              />
              {children}
            </div>
          </div>
        )}
        renderThumb={({ props, isDragged }) => (
          <div
            {...props}
            style={{
              ...props.style,
              height: '16px',
              width: '16px',
              borderRadius: '3px',
              backgroundColor: isDragged ? '#3498db' : '#444',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              boxShadow: '0px 1px 4px rgba(0,0,0,0.4)',
              border: '1px solid #555',
              cursor: 'ew-resize'
            }}
          >
            <div style={{
              width: '2px',
              height: '8px',
              backgroundColor: isDragged ? '#fff' : '#888'
            }} />
          </div>
        )}
      />
      {/* Third center handle below the slider for easier range dragging */}
      <div
        onMouseDown={handleMiddleMouseDown}
        onTouchStart={handleMiddleMouseDown}
        style={{
          position: 'absolute',
          left: `${centerPosition * 100}%`,
          transform: 'translate(-50%, 50%)',
          top: '40px',
          width: '28px',
          height: '20px',
          borderRadius: '4px',
          backgroundColor: isDraggingMiddle ? '#3498db' : '#444',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0px 1px 4px rgba(0,0,0,0.4)',
          border: '1px solid #555',
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        <div style={{
          display: 'flex',
          gap: '3px',
        }}>
          <div style={{ width: '2px', height: '10px', backgroundColor: isDraggingMiddle ? '#fff' : '#888' }} />
          <div style={{ width: '2px', height: '10px', backgroundColor: isDraggingMiddle ? '#fff' : '#888' }} />
        </div>
      </div>
    </div>
  );
};

const RangeSlider = ({ label, min, max, values, onChange, isMobile }) => (
  <div style={{ marginBottom: '15px' }}>
    <label style={{ 
      display: 'flex', 
      alignItems: 'center', 
      marginBottom: '5px',
      fontSize: isMobile ? '14px' : '16px', // Updated to 16px for desktop
    }}>
      <FaImages style={{ marginRight: '10px' }} />
      {label}:
    </label>
    <Range
      values={values}
      step={1}
      min={min}
      max={max}
      onChange={onChange}
      renderTrack={({ props, children }) => (
        <div
          onMouseDown={props.onMouseDown}
          onTouchStart={props.onTouchStart}
          style={{
            ...props.style,
            height: '36px',
            display: 'flex',
            width: '100%'
          }}
        >
          <div
            ref={props.ref}
            style={{
              height: '5px',
              width: '100%',
              borderRadius: '4px',
              background: getTrackBackground({
                values,
                colors: ['#333333', '#3498db', '#333333'], // Updated colors
                min,
                max
              }),
              alignSelf: 'center'
            }}
          >
            {children}
          </div>
        </div>
      )}
      renderThumb={({ props, isDragged }) => (
        <div
          {...props}
          style={{
            ...props.style,
            height: '20px',
            width: '20px',
            borderRadius: '4px',
            backgroundColor: '#333333', // Darker thumb
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0px 2px 6px rgba(0,0,0,0.3)',
            border: '1px solid #404040'
          }}
        >
          <div
            style={{
              height: '16px',
              width: '5px',
              backgroundColor: isDragged ? '#3498db' : '#666666' // Updated colors
            }}
          />
        </div>
      )}
    />
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      marginTop: '5px',
      fontSize: isMobile ? '14px' : '16px', // Updated to 16px for desktop
    }}>
      <span>{values[0].toFixed(0)}%</span>
      <span>{values[1].toFixed(0)}%</span>
    </div>
  </div>
);

// Update the ControlGroup component to accept isMobile prop
export const ControlGroup = ({ children, isMobile, style }) => (
  <div style={{ 
    marginBottom: isMobile ? '16px' : '0px', // Reduced from 20px to 15px for desktop
    padding: isMobile ? '12px' : '15px',
    backgroundColor: '#282c34',
    borderRadius: '8px',
    border: '1px solid #404040',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
    ...style // Spread the style prop
  }}>
    {children}
  </div>
);

const ControlPanel = ({ 
  stackLength, setStackLength,
  framePercentage, setFramePercentage,
  opacity, setOpacity,
  brightness, setBrightness,
  blendMode, setBlendMode,
  sliceRange, setSliceRange,
  isMobile, isOpen,
  onImmediateOpacityChange,
  onImmediateBrightnessChange,
  onImmediateGlobalLightChange,
  onImmediateStackLengthChange,
  onImmediateFramePercentageChange,
  onImmediateSlicePositionChange,
  globalLightIntensity, setGlobalLightIntensity,
  colorMap, setColorMap,
  colorMapParams, setColorMapParams,
  onClipPlanesChange,
  exposure, setExposure,
  contrast, setContrast,
  onImmediateExposureChange,
  onImmediateContrastChange,
  rectangle, // Add this
  onRectangleChange, // Add this
  style, // Add this prop
  frameAspectRatio,
  children,
  isOrthographic,
  textureFilters, 
  setTextureFilters,
  onTextureFilterChange,
  onRotationLockChange,
  isRotationLocked,
  // Volume rendering props
  renderMode,
  setRenderMode,
  volumeThreshold,
  setVolumeThreshold,
  volumeStepSize,
  setVolumeStepSize,
  volumeRenderType,
  setVolumeRenderType,
  volumeLength,
  setVolumeLength,
  volumeClipBounds,
  setVolumeClipBounds,
  volumeLighting,
  setVolumeLighting,
  volumeTransferFunction,
  setVolumeTransferFunction,
  volumeIsosurface,
  setVolumeIsosurface,
  volumeClipMode,
  setVolumeClipMode,
  volumeSphereClip,
  setVolumeSphereClip,
  volumeCurve,
  setVolumeCurve,
}) => {
  const convertNonLinear = (value, maxOutput) => {
    if (value <= 0.2) {
      return value * 0.5;
    } else {
      return 0.1 + (value - 0.2) * (maxOutput - 0.1) / 0.8;
    }
  };

  const convertBrightness = (value) => convertNonLinear(value, 2);
  const convertOpacity = (value) => convertNonLinear(value, 0.98);

  const blendModes = [
    { name: 'Normal', value: BABYLON.Constants.ALPHA_COMBINE },
    { name: 'Add', value: BABYLON.Constants.ALPHA_ADD },
    { name: 'Subtract', value: BABYLON.Constants.ALPHA_SUBTRACT },
    { name: 'Maximum', value: BABYLON.Constants.ALPHA_MAXIMIZED },
  ];

  const handleSlicePositionChange = (newPosition) => {
    const rangeWidth = sliceRange[1] - sliceRange[0];
    const newStart = Math.max(0, Math.min(newPosition, 100 - rangeWidth));
    const newEnd = Math.min(100, newStart + rangeWidth);
    setSliceRange([newStart, newEnd]);
  };

  const colorMaps = getColorMapNames();
  const currentColorMap = ColorMaps[colorMap];
  const hasParams = currentColorMap?.defaultParams !== undefined;

  return (
    <div style={{
      width: isMobile ? '100%' : '320px',
      height: isMobile ? (isOpen ? '340px' : '0') : '100%',
      padding: isMobile ? (isOpen ? '15px 10px' : '0') : '25px 20px',
      backgroundColor: '#1a1a1a',
      overflowY: 'auto',
      transition: 'height 0.2s ease-in-out, padding 0.2s ease-in-out',
      boxSizing: 'border-box',
      position: isMobile ? 'fixed' : 'relative',
      bottom: isMobile ? 0 : 'auto',
      left: 0,
      right: 0,
      zIndex: 1000,
      color: '#ffffff',
      borderLeft: '1px solid #404040',
      boxShadow: isMobile ? 'none' : '-2px 0 10px rgba(0, 0, 0, 0.2)',
      ...style // Spread the style prop
    }}>
      {(!isMobile || isOpen) && (
        <>
          {isMobile && (
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '0 15px 15px',
              borderBottom: '1px solid #404040'
            }}>
              <div
                onClick={() => onRotationLockChange(!isRotationLocked)}
                style={{
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '4px',
                  backgroundColor: isRotationLocked ? '#3498db33' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
              >
                {isRotationLocked ? <FaLock /> : <FaLockOpen />}
                <span>Rotation {isRotationLocked ? 'Locked' : 'Unlocked'}</span>
              </div>
            </div>
          )}
          
          {!isMobile && (
            <h3 style={{ 
              margin: 0, 
              marginBottom: '25px', 
              color: '#ffffff', 
              textAlign: 'center',
              fontSize: '20px',
              fontWeight: '500',
              letterSpacing: '0.5px',
              borderBottom: '1px solid #404040',
              paddingBottom: '15px'
            }}>Control Panel</h3>
          )}
          
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'row' : 'column', 
            gap: isMobile ? '8px' : '24px',
            height: isMobile ? '100%' : 'auto',
            maxWidth: '100%',
            margin: '0 auto',
          }}>
            {/* Slice Control - hide in volume mode */}
            {!isMobile && renderMode !== 'volume' && (
              <ControlGroup isMobile={isMobile}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                  <SliceControl
                    width={200}
                    height={200}
                    onClipPlanesChange={onClipPlanesChange}
                    rectangle={rectangle}
                    onRectangleChange={onRectangleChange}
                    isMobile={isMobile}
                    frameAspectRatio={frameAspectRatio}
                  />
                </div>
              </ControlGroup>
            )}

            {/* Left column - Appearance */}
            <div style={{ 
              flex: isMobile ? '0 0 calc(50% - 5px)' : 'auto',
              minWidth: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: isMobile ? '5px' : 0,
              height: isMobile ? '100%' : 'auto',
              boxSizing: 'border-box',
            }}>
              <ControlGroup isMobile={isMobile}>
                <ControlItem
                  icon={<FaEye />}
                  label="Opacity"
                  value={opacity}
                  min={0.01}
                  max={0.98}
                  step={0.01}
                  onChange={setOpacity}
                  onImmediateChange={onImmediateOpacityChange}
                  convertValue={convertOpacity}
                  displayValue={(v) => v.toFixed(2)}
                  isMobile={isMobile}
                />
                <ControlItem
                  icon={<FaSun />}
                  label="Brightness"
                  value={brightness}
                  min={0.01}
                  max={1}
                  step={0.01}
                  onChange={setBrightness}
                  onImmediateChange={onImmediateBrightnessChange}
                  convertValue={convertBrightness}
                  displayValue={(v) => v.toFixed(2)}
                  isMobile={isMobile}
                />
                <ControlItem
                  icon={<FaSun />}
                  label="Exposure"
                  value={exposure}
                  min={0.01}
                  max={4}
                  step={0.1}
                  onChange={setExposure}
                  onImmediateChange={onImmediateExposureChange}
                  isMobile={isMobile}
                />
                <ControlItem
                  icon={<FaAdjust />}
                  label="Contrast"
                  value={contrast}
                  min={0.01}
                  max={4}
                  step={0.1}
                  onChange={setContrast}
                  onImmediateChange={onImmediateContrastChange}
                  isMobile={isMobile}
                />
                {/* Global Light - hide in volume mode */}
                {renderMode !== 'volume' && (
                  <ControlItem
                    icon={<FaLightbulb />}
                    label="Global Light"
                    value={globalLightIntensity}
                    min={0}
                    max={5}
                    step={0.01}
                    onChange={setGlobalLightIntensity}
                    onImmediateChange={onImmediateGlobalLightChange}
                    isMobile={isMobile}
                  />
                )}
                {/* Blend Mode - hide in volume mode */}
                {renderMode !== 'volume' && (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <FaPalette style={{ marginRight: '10px' }} />
                      Blend Mode:
                    </label>
                    <select 
                      value={blendMode} 
                      onChange={(e) => setBlendMode(parseInt(e.target.value))}
                      style={{ 
                        width: '100%', 
                        padding: '8px 10px', // More padding
                      backgroundColor: '#333333',
                      color: '#ffffff',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                      marginLeft: 0,
                      fontSize: isMobile ? '14px' : '16px', // Updated to 16px for desktop
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                      ':hover': {
                        borderColor: '#3498db'
                      }
                    }}
                  >
                    {blendModes.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.name}
                      </option>
                    ))}
                  </select>
                  </div>
                )}

                {/* Volume Rendering Controls */}
                {renderMode === 'volume' && setVolumeThreshold && (
                  <>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                        <FaAdjust style={{ marginRight: '10px' }} />
                        Volume Type:
                      </label>
                      <select 
                        value={volumeRenderType || 0} 
                        onChange={(e) => setVolumeRenderType(parseInt(e.target.value))}
                        style={{ 
                          width: '100%', 
                          padding: '8px 10px',
                          backgroundColor: '#333333',
                          color: '#ffffff',
                          border: '1px solid #404040',
                          borderRadius: '6px',
                          fontSize: isMobile ? '14px' : '16px',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <option value={0}>Accumulate</option>
                        <option value={1}>Max Intensity (MIP)</option>
                        <option value={2}>Isosurface</option>
                      </select>
                    </div>
                    {/* Threshold - only show in Accumulate mode */}
                    {volumeRenderType === 0 && (
                      <ControlItem
                        icon={<FaEye />}
                        label="Threshold"
                        value={volumeThreshold}
                        min={0}
                        max={0.5}
                        step={0.01}
                        onChange={setVolumeThreshold}
                        displayValue={(v) => v.toFixed(2)}
                        isMobile={isMobile}
                      />
                    )}
                    {/* Isosurface controls - only show in Isosurface mode */}
                    {volumeRenderType === 2 && (
                      <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ display: 'flex', alignItems: 'center' }}>
                              <FaEye style={{ marginRight: '8px' }} />
                              Isosurface Level
                            </span>
                            <span style={{ color: '#666' }}>{(volumeIsosurface?.level || 0.3).toFixed(2)}</span>
                          </div>
                          <input type="range" min="0.05" max="0.95" step="0.01"
                            value={volumeIsosurface?.level || 0.3}
                            onChange={(e) => setVolumeIsosurface(prev => ({...prev, level: parseFloat(e.target.value)}))}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span>Smoothness</span>
                            <span style={{ color: '#666' }}>{(volumeIsosurface?.smoothness || 1.0).toFixed(1)}</span>
                          </div>
                          <input type="range" min="0.25" max="2" step="0.25"
                            value={volumeIsosurface?.smoothness || 1.0}
                            onChange={(e) => setVolumeIsosurface(prev => ({...prev, smoothness: parseFloat(e.target.value)}))}
                            style={{ width: '100%' }}
                          />
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span>Opacity</span>
                            <span style={{ color: '#666' }}>{(volumeIsosurface?.opacity || 1.0).toFixed(2)}</span>
                          </div>
                          <input type="range" min="0.1" max="1" step="0.05"
                            value={volumeIsosurface?.opacity || 1.0}
                            onChange={(e) => setVolumeIsosurface(prev => ({...prev, opacity: parseFloat(e.target.value)}))}
                            style={{ width: '100%' }}
                          />
                        </div>
                      </div>
                    )}
                    <ControlItem
                      icon={<FaLayerGroup />}
                      label="Quality"
                      value={1 - (volumeStepSize / 0.4)}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(v) => setVolumeStepSize(0.4 * (1 - v))}
                      displayValue={(v) => v.toFixed(2)}
                      isMobile={isMobile}
                    />
                    <ControlItem
                      icon={<FaArrowsAltH />}
                      label="Volume Length"
                      value={volumeLength}
                      min={0.2}
                      max={10}
                      step={0.1}
                      onChange={setVolumeLength}
                      displayValue={(v) => v.toFixed(1)}
                      isMobile={isMobile}
                    />
                  </>
                )}
              </ControlGroup>
              
              {/* Volume Clipping Controls - Separate container */}
              {renderMode === 'volume' && setVolumeClipBounds && (
                <ControlGroup isMobile={isMobile} style={{ marginTop: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '500' }}>Volume Clipping</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div
                        onClick={() => setVolumeClipMode && setVolumeClipMode('cube')}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: (volumeClipMode || 'cube') === 'cube' ? '#3498db' : '#333',
                          border: (volumeClipMode || 'cube') === 'cube' ? '1px solid #3498db' : '1px solid #555',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'all 0.2s ease'
                        }}
                        title="Box Clipping"
                      >
                        <FaCube style={{ fontSize: '14px' }} />
                      </div>
                      <div
                        onClick={() => setVolumeClipMode && setVolumeClipMode('sphere')}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: volumeClipMode === 'sphere' ? '#3498db' : '#333',
                          border: volumeClipMode === 'sphere' ? '1px solid #3498db' : '1px solid #555',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'all 0.2s ease'
                        }}
                        title="Sphere Clipping"
                      >
                        <FaCircle style={{ fontSize: '14px' }} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Box Clipping Controls */}
                  {(volumeClipMode || 'cube') === 'cube' && (
                    <>
                      <VolumeClipSlider
                        label="X Axis"
                        axis="x"
                        values={[volumeClipBounds?.xMin || 0, volumeClipBounds?.xMax || 1]}
                        onChange={([min, max]) => setVolumeClipBounds(prev => ({...prev, xMin: min, xMax: max}))}
                        isMobile={isMobile}
                      />
                      <VolumeClipSlider
                        label="Y Axis"
                        axis="y"
                        values={[volumeClipBounds?.yMin || 0, volumeClipBounds?.yMax || 1]}
                        onChange={([min, max]) => setVolumeClipBounds(prev => ({...prev, yMin: min, yMax: max}))}
                        isMobile={isMobile}
                      />
                      <VolumeClipSlider
                        label="Z Axis (Depth)"
                        values={[volumeClipBounds?.zMin || 0, volumeClipBounds?.zMax || 1]}
                        onChange={([min, max]) => setVolumeClipBounds(prev => ({...prev, zMin: min, zMax: max}))}
                        isMobile={isMobile}
                      />
                    </>
                  )}
                  
                  {/* Sphere Clipping Controls */}
                  {volumeClipMode === 'sphere' && (
                    <>
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', color: '#aaa' }}>X Position</span>
                          <span style={{ fontSize: '11px', color: '#666' }}>{(volumeSphereClip?.x || 0.5).toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={volumeSphereClip?.x || 0.5}
                          onChange={(e) => setVolumeSphereClip && setVolumeSphereClip(prev => ({...prev, x: parseFloat(e.target.value)}))}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', color: '#aaa' }}>Y Position</span>
                          <span style={{ fontSize: '11px', color: '#666' }}>{(volumeSphereClip?.y || 0.5).toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={volumeSphereClip?.y || 0.5}
                          onChange={(e) => setVolumeSphereClip && setVolumeSphereClip(prev => ({...prev, y: parseFloat(e.target.value)}))}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', color: '#aaa' }}>Z Position</span>
                          <span style={{ fontSize: '11px', color: '#666' }}>{(volumeSphereClip?.z || 0.5).toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={volumeSphereClip?.z || 0.5}
                          onChange={(e) => setVolumeSphereClip && setVolumeSphereClip(prev => ({...prev, z: parseFloat(e.target.value)}))}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', color: '#aaa' }}>Diameter</span>
                          <span style={{ fontSize: '11px', color: '#666' }}>{(volumeSphereClip?.diameter || 0.5).toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0.05"
                          max="2"
                          step="0.01"
                          value={volumeSphereClip?.diameter || 0.5}
                          onChange={(e) => setVolumeSphereClip && setVolumeSphereClip(prev => ({...prev, diameter: parseFloat(e.target.value)}))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </>
                  )}
                </ControlGroup>
              )}
              
              {/* Volume Lighting/Shading and Transfer Function continue in same flow */}
              {renderMode === 'volume' && setVolumeThreshold && (
                <ControlGroup isMobile={isMobile} style={{ marginTop: '15px' }}>
                    
                    {/* Volume Lighting/Shading Controls */}
                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          <FaLightbulb style={{ marginRight: '10px' }} />
                          Lighting / Shading
                        </span>
                        <input
                          type="checkbox"
                          checked={volumeLighting?.enabled || false}
                          onChange={(e) => setVolumeLighting(prev => ({...prev, enabled: e.target.checked}))}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </label>
                      
                      {volumeLighting?.enabled && (
                        <div style={{ fontSize: '12px' }}>
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <span>Ambient</span>
                              <span style={{ color: '#666' }}>{(volumeLighting?.ambient || 0.3).toFixed(2)}</span>
                            </div>
                            <input type="range" min="0" max="1" step="0.05"
                              value={volumeLighting?.ambient || 0.3}
                              onChange={(e) => setVolumeLighting(prev => ({...prev, ambient: parseFloat(e.target.value)}))}
                              style={{ width: '100%' }}
                            />
                          </div>
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <span>Diffuse</span>
                              <span style={{ color: '#666' }}>{(volumeLighting?.diffuse || 0.7).toFixed(2)}</span>
                            </div>
                            <input type="range" min="0" max="1" step="0.05"
                              value={volumeLighting?.diffuse || 0.7}
                              onChange={(e) => setVolumeLighting(prev => ({...prev, diffuse: parseFloat(e.target.value)}))}
                              style={{ width: '100%' }}
                            />
                          </div>
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <span>Specular</span>
                              <span style={{ color: '#666' }}>{(volumeLighting?.specular || 0.4).toFixed(2)}</span>
                            </div>
                            <input type="range" min="0" max="1" step="0.05"
                              value={volumeLighting?.specular || 0.4}
                              onChange={(e) => setVolumeLighting(prev => ({...prev, specular: parseFloat(e.target.value)}))}
                              style={{ width: '100%' }}
                            />
                          </div>
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                              <span>Shininess</span>
                              <span style={{ color: '#666' }}>{(volumeLighting?.shininess || 32).toFixed(0)}</span>
                            </div>
                            <input type="range" min="1" max="128" step="1"
                              value={volumeLighting?.shininess || 32}
                              onChange={(e) => setVolumeLighting(prev => ({...prev, shininess: parseFloat(e.target.value)}))}
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Transfer Function / Color Map for Volume */}
                    <div style={{ marginTop: '15px', marginBottom: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                        <FaPalette style={{ marginRight: '10px' }} />
                        Color Map
                      </label>
                      <select
                        value={volumeTransferFunction || 'grayscale'}
                        onChange={(e) => setVolumeTransferFunction(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          backgroundColor: '#333333',
                          color: '#ffffff',
                          border: '1px solid #404040',
                          borderRadius: '6px',
                          fontSize: '14px',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="grayscale">Grayscale</option>
                        <option value="heat">Heat (Black → Red → Yellow → White)</option>
                        <option value="cool">Cool (Black → Blue → Cyan → White)</option>
                        <option value="bone">Bone (Blue-tinted grayscale)</option>
                        <option value="copper">Copper (Black → Orange → Peach)</option>
                        <option value="viridis">Viridis (Purple → Blue → Green → Yellow)</option>
                        <option value="plasma">Plasma (Purple → Pink → Orange → Yellow)</option>
                        <option value="rainbow">Rainbow</option>
                      </select>
                    </div>
                    
                    {/* Visualization Presets and Curve Controls */}
                    <div style={{ marginTop: '15px', marginBottom: '10px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                        <FaAdjust style={{ marginRight: '10px' }} />
                        Visualization Preset
                      </label>
                      <select
                        value={volumeCurve?.preset || 'default'}
                        onChange={(e) => {
                          const preset = e.target.value;
                          const presetValues = {
                            'default': { gamma: 1.0, softness: 0.3, minOpacity: 0.0 },
                            'fullRange': { gamma: 0.7, softness: 0.8, minOpacity: 0.05 },
                            'highContrast': { gamma: 1.5, softness: 0.15, minOpacity: 0.0 },
                            'softTissue': { gamma: 0.5, softness: 0.5, minOpacity: 0.1 },
                          };
                          const p = presetValues[preset] || presetValues['default'];
                          setVolumeCurve && setVolumeCurve({ ...p, preset });
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          backgroundColor: '#333333',
                          color: '#ffffff',
                          border: '1px solid #404040',
                          borderRadius: '6px',
                          fontSize: '14px',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="default">Default</option>
                        <option value="fullRange">Full Range (reveals low-intensity)</option>
                        <option value="highContrast">High Contrast</option>
                        <option value="softTissue">Soft Tissue (hypoechoic structures)</option>
                      </select>
                      
                      {/* Gamma slider */}
                      <div style={{ marginTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', color: '#aaa' }}>Gamma</span>
                          <span style={{ fontSize: '11px', color: '#666' }}>{(volumeCurve?.gamma || 1.0).toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="3.0"
                          step="0.05"
                          value={volumeCurve?.gamma || 1.0}
                          onChange={(e) => setVolumeCurve && setVolumeCurve(prev => ({...prev, gamma: parseFloat(e.target.value), preset: 'custom'}))}
                          style={{ width: '100%' }}
                        />
                      </div>
                      
                      {/* Softness slider */}
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', color: '#aaa' }}>Softness</span>
                          <span style={{ fontSize: '11px', color: '#666' }}>{(volumeCurve?.softness || 0.3).toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0.01"
                          max="1.0"
                          step="0.01"
                          value={volumeCurve?.softness || 0.3}
                          onChange={(e) => setVolumeCurve && setVolumeCurve(prev => ({...prev, softness: parseFloat(e.target.value), preset: 'custom'}))}
                          style={{ width: '100%' }}
                        />
                      </div>
                      
                      {/* Min Opacity slider */}
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', color: '#aaa' }}>Min Opacity (preserve low-intensity)</span>
                          <span style={{ fontSize: '11px', color: '#666' }}>{(volumeCurve?.minOpacity || 0.0).toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="0.5"
                          step="0.01"
                          value={volumeCurve?.minOpacity || 0.0}
                          onChange={(e) => setVolumeCurve && setVolumeCurve(prev => ({...prev, minOpacity: parseFloat(e.target.value), preset: 'custom'}))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                </ControlGroup>
              )}
                
              {/* Color Map - hide in volume mode */}
              {renderMode !== 'volume' && (
                <ControlGroup isMobile={isMobile} style={{ marginTop: '15px' }}>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                      <FaAdjust style={{ marginRight: '10px' }} />
                      Color Map:
                    </label>
                    <select 
                      value={colorMap} 
                      onChange={(e) => {
                        const newColorMap = e.target.value;
                        setColorMap(newColorMap);
                        setColorMapParams(ColorMaps[newColorMap]?.defaultParams || {});
                      }}
                      style={{ 
                        width: '100%', 
                        padding: '8px 10px',
                        backgroundColor: '#333333',
                        color: '#ffffff',
                        border: '1px solid #404040',
                        borderRadius: '6px',
                        marginLeft: 0,
                        fontSize: isMobile ? '14px' : '16px',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'border-color 0.2s ease',
                        ':hover': {
                          borderColor: '#3498db'
                        }
                      }}
                    >
                      {colorMaps.map((map) => (
                        <option key={map.key} value={map.key}>
                          {map.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Color Map Parameters */}
                  {hasParams && (
                    <div style={{ marginTop: '10px' }}>
                      {Object.entries(currentColorMap.defaultParams).map(([key, defaultValue]) => (
                        <ControlItem
                          key={key}
                          label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                          value={colorMapParams[key] || defaultValue}
                          min={0}
                          max={key.includes('Offset') ? 2 : 3}
                          step={0.1}
                          onChange={(value) => {
                            setColorMapParams({
                              ...colorMapParams,
                              [key]: value
                            });
                          }}
                          displayValue={(v) => v.toFixed(2)}
                        />
                      ))}
                    </div>
                  )}
                </ControlGroup>
              )}
            </div>

            {/* Right column */}
            <div style={{ 
              flex: isMobile ? '0 0 calc(50% - 5px)' : 'auto',
              minWidth: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingLeft: isMobile ? '5px' : 0,
              height: isMobile ? '100%' : 'auto',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Mobile Slice Control - hide in volume mode */}
              {isMobile && renderMode !== 'volume' && (
                <ControlGroup isMobile={isMobile}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                    <SliceControl
                      width={200}
                      height={200}
                      onClipPlanesChange={onClipPlanesChange}
                      rectangle={rectangle}
                      onRectangleChange={onRectangleChange}
                      isMobile={isMobile}
                      frameAspectRatio={frameAspectRatio}
                    />
                  </div>
                </ControlGroup>
              )}

              {/* Plane-specific controls - hide in volume mode */}
              {renderMode !== 'volume' && (
                <ControlGroup isMobile={isMobile}>
                  <ControlItem
                    icon={<FaLayerGroup />}
                    label="Stack Length"
                    value={stackLength}
                    min={0.20}
                    max={3}
                    step={0.01}
                    onChange={setStackLength}
                    onImmediateChange={onImmediateStackLengthChange}
                    isMobile={isMobile}
                  />
                  <ControlItem
                    icon={<FaImages />}
                    label="Frames to Show"
                    value={framePercentage}
                    min={1}
                    max={100}
                    step={0.1}
                    onChange={setFramePercentage}
                    onImmediateChange={onImmediateFramePercentageChange}
                    unit="%"
                    isMobile={isMobile}
                  />
                  <RangeSlider
                    label="Slice Range"
                    min={0}
                    max={100}
                    values={sliceRange}
                    onChange={setSliceRange}
                    isMobile={isMobile}
                  />
                  <ControlItem
                    icon={<FaArrowsAltH />}
                    label="Slice Position"
                    value={sliceRange[0]}
                    min={0}
                    max={100 - (sliceRange[1] - sliceRange[0])}
                    step={1}
                    onChange={handleSlicePositionChange}
                    onImmediateChange={onImmediateSlicePositionChange}
                    unit="%"
                    isMobile={isMobile}
                  />
                </ControlGroup>
              )}
            </div>
          </div>
        </>
      )}
      {/* Texture filters - hide in volume mode */}
      {renderMode !== 'volume' && (
        <ControlGroup isMobile={isMobile} style={{ marginTop: isMobile ? 0 : '24px' }}>
          <ControlItem
            icon={<FaSun />}
            label="Texture Brightness"
            value={textureFilters.brightness}
            min={0.1}
            max={3}
            step={0.1}
            onChange={(value) => {
              const newFilters = { ...textureFilters, brightness: value };
              setTextureFilters(newFilters);
              onTextureFilterChange(newFilters);
            }}
            isMobile={isMobile}
          />

          <ControlItem
            icon={<FaAdjust />}
            label="Texture Contrast"
            value={textureFilters.contrast}
            min={0}
            max={3}
            step={0.1}
            onChange={(value) => {
              const newFilters = { ...textureFilters, contrast: value };
              setTextureFilters(newFilters);
              onTextureFilterChange(newFilters);
            }}
            isMobile={isMobile}
          />
        </ControlGroup>
      )}
    </div>
  );
};

export default ControlPanel;
