import React, { useState, useEffect } from 'react';
import { FaLayerGroup, FaImages, FaEye, FaSun, FaPalette, FaArrowsAltH, FaLightbulb, FaAdjust, FaMagic, FaSlidersH, FaDice, FaRainbow } from 'react-icons/fa';
import * as BABYLON from '@babylonjs/core';
import { Range, getTrackBackground } from 'react-range';
import { getColorMapNames, ColorMaps } from '../utils/ColorMaps';
import SliceControl from './SliceControl';
import useDebounce from '../hooks/useDebounce';

const ControlItem = ({ icon, label, value, min, max, step, onChange, unit = '', convertValue, displayValue, onImmediateChange }) => {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, 16); // 60fps = ~16ms

  // Update local value when prop value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Apply debounced value
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, value]);

  return (
    <div style={{ marginBottom: '15px' }}>
      <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
        {icon && <span style={{ marginRight: '10px' }}>{icon}</span>}
        {label}:
      </label>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue}
          onChange={(e) => {
            const newValue = parseFloat(e.target.value);
            setLocalValue(newValue);
            if (onImmediateChange) {
              onImmediateChange(newValue);
            }
          }}
          style={{ flex: 1, marginRight: '10px' }}
        />
        <span style={{ minWidth: '50px', textAlign: 'right' }}>
          {(displayValue || ((v) => v.toFixed(2)))(convertValue ? convertValue(localValue) : localValue)}{unit}
        </span>
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
                colors: ['#ccc', '#548BF4', '#ccc'],
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
            backgroundColor: '#FFF',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            boxShadow: '0px 2px 6px #AAA'
          }}
        >
          <div
            style={{
              height: '16px',
              width: '5px',
              backgroundColor: isDragged ? '#548BF4' : '#CCC'
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

// Export ControlGroup so it can be imported elsewhere
export const ControlGroup = ({ title, children, headerAction }) => (
  <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e0e0e0', borderRadius: '5px' }}>
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      marginBottom: '10px' 
    }}>
      <h4 style={{ margin: 0 }}>{title}</h4>
      {headerAction}
    </div>
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
  onImmediatePostProcessingChange,
  globalLightIntensity, setGlobalLightIntensity,
  colorMap, setColorMap,
  colorMapParams, setColorMapParams,
  postProcessing = {},
  setPostProcessing,
  onClipPlanesChange, // Add this prop
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
      width: isMobile ? '100%' : '250px',
      height: isMobile ? (isOpen ? '400px' : '0') : '100%',
      padding: isMobile ? (isOpen ? '20px' : '0') : '20px',
      backgroundColor: '#f0f0f0',
      overflowY: 'auto',
      transition: 'height 0.2s ease-in-out, padding 0.2s ease-in-out',
      boxSizing: 'border-box',
      position: isMobile ? 'fixed' : 'relative',
      bottom: isMobile ? 0 : 'auto',
      left: 0,
      right: 0,
      zIndex: 1000,
    }}>
      {(!isMobile || isOpen) && (
        <>
          {/* Only show header on desktop */}
          {!isMobile && (
            <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#333', textAlign: 'center' }}>Control Panel</h3>
          )}
          
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'row' : 'column', 
            gap: '20px',
            height: isMobile ? '100%' : 'auto',
          }}>
            {/* Left column - Appearance */}
            <div style={{ 
              flex: isMobile ? 1 : 'auto',
              minWidth: isMobile ? 0 : 'auto',
              overflowY: isMobile ? 'auto' : 'visible',
              paddingRight: isMobile ? '10px' : 0,
              height: isMobile ? '100%' : 'auto',
            }}>
              <ControlGroup title="Slice Control">
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                  <SliceControl
                    width={200}
                    height={200}
                    onClipPlanesChange={onClipPlanesChange}
                  />
                </div>
              </ControlGroup>

              <ControlGroup title="Appearance">
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
                />
                <ControlItem
                  icon={<FaSun />}
                  label="Exposure"
                  value={postProcessing.exposure || 1}
                  min={0.01}  // Changed from 0 to 0.01
                  max={4}
                  step={0.1}
                  onChange={(value) => setPostProcessing({
                    ...postProcessing,
                    exposure: value
                  })}
                  onImmediateChange={onImmediatePostProcessingChange('exposure')}
                />
                <ControlItem
                  icon={<FaAdjust />}
                  label="Contrast"
                  value={postProcessing.contrast || 1}
                  min={0.01}  // Changed from 0 to 0.01
                  max={4}
                  step={0.1}
                  onChange={(value) => setPostProcessing({
                    ...postProcessing,
                    contrast: value
                  })}
                  onImmediateChange={onImmediatePostProcessingChange('contrast')}
                />
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <FaPalette style={{ marginRight: '10px' }} />
                    Blend Mode:
                  </label>
                  <select 
                    value={blendMode} 
                    onChange={(e) => setBlendMode(parseInt(e.target.value))}
                    style={{ width: '100%', padding: '5px' }}
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
                      // Reset params to defaults when changing color map
                      setColorMapParams(ColorMaps[newColorMap]?.defaultParams || {});
                    }}
                    style={{ width: '100%', padding: '5px' }}
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

            {/* Divider (only on mobile) */}
            {isMobile && (
              <div style={{
                width: '1px',
                backgroundColor: '#ccc',
                alignSelf: 'stretch',
                margin: '0 -10px',
              }} />
            )}

            {/* Right column - Frame Control and Post Processing */}
            <div style={{ 
              flex: isMobile ? 1 : 'auto',
              minWidth: isMobile ? 0 : 'auto',
              overflowY: isMobile ? 'auto' : 'visible',
              paddingRight: isMobile ? '10px' : 0,
              height: isMobile ? '100%' : 'auto',
            }}>
              <ControlGroup title="Frame Control">
                <ControlItem
                  icon={<FaLayerGroup />}
                  label="Stack Length"
                  value={stackLength}
                  min={0.20}
                  max={3}
                  step={0.01}
                  onChange={setStackLength}
                />
                <ControlItem
                  icon={<FaImages />}
                  label="Frames to Show"
                  value={framePercentage}
                  min={1}
                  max={100}
                  step={0.1}
                  onChange={setFramePercentage}
                  unit="%"
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
                  unit="%"
                />
              </ControlGroup>
              <ControlGroup title="Post Processing">
                {/* Image Processing Controls */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <FaMagic style={{ marginRight: '10px' }} />
                    Bloom Effect:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={postProcessing.bloomEnabled}
                      onChange={(e) => setPostProcessing({
                        ...postProcessing,
                        bloomEnabled: e.target.checked
                      })}
                    />
                  </div>
                  {postProcessing.bloomEnabled && (
                    <>
                      <ControlItem
                        label="Bloom Threshold"
                        value={postProcessing.bloomThreshold || 0.8}
                        min={0.01}  // Changed from 0 to 0.01
                        max={1}
                        step={0.1}
                        onChange={(value) => setPostProcessing({
                          ...postProcessing,
                          bloomThreshold: value
                        })}
                      />
                      <ControlItem
                        label="Bloom Weight"
                        value={postProcessing.bloomWeight || 0.3}
                        min={0.01}  // Changed from 0 to 0.01
                        max={1}
                        step={0.1}
                        onChange={(value) => setPostProcessing({
                          ...postProcessing,
                          bloomWeight: value
                        })}
                      />
                    </>
                  )}
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <FaSlidersH style={{ marginRight: '10px' }} />
                    Sharpen Effect:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={postProcessing.sharpenEnabled}
                      onChange={(e) => setPostProcessing({
                        ...postProcessing,
                        sharpenEnabled: e.target.checked
                      })}
                    />
                  </div>
                  {postProcessing.sharpenEnabled && (
                    <ControlItem
                      label="Sharpen Amount"
                      value={postProcessing.sharpenAmount || 0.3}
                      min={0.01}  // Changed from 0 to 0.01
                      max={1}
                      step={0.1}
                      onChange={(value) => setPostProcessing({
                        ...postProcessing,
                        sharpenAmount: value
                      })}
                    />
                  )}
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <FaDice style={{ marginRight: '10px' }} />
                    Grain Effect:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={postProcessing.grainEnabled}
                      onChange={(e) => setPostProcessing({
                        ...postProcessing,
                        grainEnabled: e.target.checked
                      })}
                    />
                  </div>
                  {postProcessing.grainEnabled && (
                    <ControlItem
                      label="Grain Intensity"
                      value={postProcessing.grainIntensity || 10}
                      min={0.01}  // Changed from 0 to 0.01
                      max={50}
                      step={1}
                      onChange={(value) => setPostProcessing({
                        ...postProcessing,
                        grainIntensity: value
                      })}
                    />
                  )}
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                    <FaRainbow style={{ marginRight: '10px' }} />
                    Chromatic Aberration:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={postProcessing.chromaticAberrationEnabled}
                      onChange={(e) => setPostProcessing({
                        ...postProcessing,
                        chromaticAberrationEnabled: e.target.checked
                      })}
                    />
                  </div>
                  {postProcessing.chromaticAberrationEnabled && (
                    <ControlItem
                      label="Aberration Amount"
                      value={postProcessing.chromaticAberrationAmount || 30}
                      min={0.01}  // Changed from 0 to 0.01
                      max={100}
                      step={1}
                      onChange={(value) => setPostProcessing({
                        ...postProcessing,
                        chromaticAberrationAmount: value
                      })}
                    />
                  )}
                </div>
              </ControlGroup>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ControlPanel;
