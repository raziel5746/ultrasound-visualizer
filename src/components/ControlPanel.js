import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaLayerGroup, FaImages, FaEye, FaSun, FaPalette, FaArrowsAltH, FaLightbulb, FaAdjust } from 'react-icons/fa';
import * as BABYLON from '@babylonjs/core';
import { Range, getTrackBackground } from 'react-range';
import { getColorMapNames, ColorMaps } from '../utils/ColorMaps';
import SliceControl from './SliceControl';
import useDebounce from '../hooks/useDebounce';

const ControlItem = ({ icon, label, value, min, max, step, onChange, unit = '', convertValue, displayValue, onImmediateChange, isMobile }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, 16);
  const lastImmediateValue = useRef(value);
  const lastUpdateTime = useRef(0);
  const updateScheduled = useRef(false);

  // Only update local value from props when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
      lastImmediateValue.current = value;
    }
  }, [value, isDragging]);

  // Apply debounced value
  useEffect(() => {
    if (isDragging && Math.abs(debouncedValue - lastImmediateValue.current) > Number.EPSILON) {
      lastImmediateValue.current = debouncedValue;
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, isDragging]);

  const scheduleUpdate = useCallback((newValue) => {
    if (!updateScheduled.current) {
      updateScheduled.current = true;
      requestAnimationFrame(() => {
        const now = performance.now();
        if (now - lastUpdateTime.current >= 16) {
          if (onImmediateChange) {
            onImmediateChange(newValue);
          }
          lastUpdateTime.current = now;
        }
        updateScheduled.current = false;
      });
    }
  }, [onImmediateChange]);

  const handleChange = (e) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);
    lastImmediateValue.current = newValue;
    scheduleUpdate(newValue);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (Math.abs(localValue - value) > Number.EPSILON) {
      onChange(localValue);
      if (onImmediateChange) {
        onImmediateChange(localValue);
      }
    }
  };

  return (
    <div style={{ 
      marginBottom: isMobile ? '15px' : '20px',
      opacity: isDragging ? 1 : 0.9, // Add subtle hover effect
      transition: 'opacity 0.2s ease'
    }}>
      <label style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '8px',
        fontSize: isMobile ? '14px' : '15px',
        fontWeight: '500',
        color: '#ffffff',
        opacity: 0.9
      }}>
        {icon && <span style={{ 
          marginRight: '10px',
          color: '#ffffff' // Changed from #3498db back to white
        }}>{icon}</span>}
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
        {!isMobile && ( // Only show the number in desktop view
          <span style={{ minWidth: '50px', textAlign: 'right' }}>
            {(displayValue || ((v) => v.toFixed(2)))(convertValue ? convertValue(localValue) : localValue)}{unit}
          </span>
        )}
      </div>
    </div>
  );
};

const RangeSlider = ({ label, min, max, values, onChange }) => (
  <div style={{ marginBottom: '15px' }}>
    <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
      <span>{values[0].toFixed(0)}%</span>
      <span>{values[1].toFixed(0)}%</span>
    </div>
  </div>
);

// Update the ControlGroup component to accept isMobile prop
export const ControlGroup = ({ children, isMobile }) => (
  <div style={{ 
    marginBottom: isMobile ? '15px' : '20px',
    padding: isMobile ? '12px' : '15px',
    backgroundColor: '#282c34',
    borderRadius: '8px',
    border: '1px solid #404040',
    width: '100%',
    boxSizing: 'border-box',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
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
  // Add these new props
  exposure, setExposure,
  contrast, setContrast,
  onImmediateExposureChange,
  onImmediateContrastChange,
  children
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
    { name: 'Multiply', value: BABYLON.Constants.ALPHA_MULTIPLY },
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
      width: isMobile ? '100%' : '320px', // Slightly wider
      height: isMobile ? (isOpen ? '400px' : '0') : '100%',
      padding: isMobile ? (isOpen ? '15px 10px' : '0') : '25px 20px', // More padding on desktop
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
      boxShadow: isMobile ? 'none' : '-2px 0 10px rgba(0, 0, 0, 0.2)' // Add shadow on desktop
    }}>
      {(!isMobile || isOpen) && (
        <>
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
            gap: isMobile ? '10px' : '25px', // Increased gap on desktop
            height: isMobile ? '100%' : 'auto',
            maxWidth: '100%',
            margin: '0 auto',
          }}>
            {/* Left column - Appearance */}
            <div style={{ 
              flex: isMobile ? '0 0 calc(50% - 5px)' : 'auto', // Account for gap
              minWidth: 0, // Allow shrinking
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: isMobile ? '5px' : 0, // Reduced padding
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
                      fontSize: '14px',
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
                      padding: '8px 10px', // More padding
                      backgroundColor: '#333333',
                      color: '#ffffff',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                      marginLeft: 0,
                      fontSize: '14px',
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
            </div>

            {/* Right column */}
            <div style={{ 
              flex: isMobile ? '0 0 calc(50% - 5px)' : 'auto', // Account for gap
              minWidth: 0, // Allow shrinking
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingLeft: isMobile ? '5px' : 0, // Reduced padding
              height: isMobile ? '100%' : 'auto',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <ControlGroup isMobile={isMobile}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                  <SliceControl
                    width={200}
                    height={200}
                    onClipPlanesChange={onClipPlanesChange}
                  />
                </div>
              </ControlGroup>

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
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ControlPanel;
