import React from 'react';
import { FaLayerGroup, FaImages, FaEye, FaSun, FaPalette, FaUndo, FaArrowsAltH, FaLightbulb } from 'react-icons/fa';
import * as BABYLON from '@babylonjs/core';
import { Range, getTrackBackground } from 'react-range';

const ControlItem = ({ icon, label, value, min, max, step, onChange, unit = '', convertValue, displayValue, onImmediateChange }) => (
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
        value={value}
        onChange={(e) => {
          const newValue = parseFloat(e.target.value);
          onChange(newValue);
          if (onImmediateChange) {
            onImmediateChange(newValue);
          }
        }}
        style={{ flex: 1, marginRight: '10px' }}
      />
      <span style={{ minWidth: '50px', textAlign: 'right' }}>
        {(displayValue || ((v) => v.toFixed(2)))(convertValue ? convertValue(value) : value)}{unit}
      </span>
    </div>
  </div>
);

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

const ControlGroup = ({ title, children }) => (
  <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e0e0e0', borderRadius: '5px' }}>
    <h4 style={{ marginTop: 0, marginBottom: '10px' }}>{title}</h4>
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
  resetToDefaults,
  onImmediateOpacityChange,
  onImmediateBrightnessChange,
  globalLightIntensity, setGlobalLightIntensity,
}) => {
  const convertNonLinear = (value, maxOutput) => {
    if (value <= 0.2) {
      return value * 0.5;
    } else {
      return 0.1 + (value - 0.2) * (maxOutput - 0.1) / 0.8;
    }
  };

  const convertBrightness = (value) => convertNonLinear(value, 2);
  const convertOpacity = (value) => convertNonLinear(value, 0.98); // Changed from 0.99 to 0.98

  const blendModes = [
    { name: 'Normal', value: BABYLON.Constants.ALPHA_COMBINE },
    { name: 'Add', value: BABYLON.Constants.ALPHA_ADD },
    { name: 'Subtract', value: BABYLON.Constants.ALPHA_SUBTRACT },
    { name: 'Multiply', value: BABYLON.Constants.ALPHA_MULTIPLY },
    { name: 'Maximum', value: BABYLON.Constants.ALPHA_MAXIMIZED },
  ];

  const presets = [
    { name: 'Default', settings: { brightness: 0.5, contrast: 0.5, opacity: 0.5, blendMode: BABYLON.Constants.ALPHA_COMBINE } },
    { name: 'High Contrast', settings: { brightness: 0.6, contrast: 0.8, opacity: 0.7, blendMode: BABYLON.Constants.ALPHA_COMBINE } },
    { name: 'Soft Tissue', settings: { brightness: 0.4, contrast: 0.3, opacity: 0.6, blendMode: BABYLON.Constants.ALPHA_ADD } },
    { name: 'Bone', settings: { brightness: 0.7, contrast: 0.9, opacity: 0.8, blendMode: BABYLON.Constants.ALPHA_MAXIMIZED } },
  ];

  const applyPreset = (settings) => {
    setBrightness(settings.brightness || brightness);
    setBlendMode(settings.blendMode || blendMode);
  };

  const handleSlicePositionChange = (newPosition) => {
    const rangeWidth = sliceRange[1] - sliceRange[0];
    const newStart = Math.max(0, Math.min(newPosition, 100 - rangeWidth));
    const newEnd = Math.min(100, newStart + rangeWidth);
    setSliceRange([newStart, newEnd]);
  };

  return (
    <div style={{
      width: isMobile ? '100%' : '250px',
      height: isMobile ? (isOpen ? '300px' : '0') : '100%',
      padding: isMobile ? (isOpen ? '20px' : '0') : '20px',
      backgroundColor: '#f0f0f0',
      overflowY: 'auto',
      transition: 'height 0.3s ease-in-out, padding 0.3s ease-in-out',
      boxSizing: 'border-box',
      position: isMobile ? 'fixed' : 'relative',
      bottom: isMobile ? 0 : 'auto',
      left: 0,
      right: 0,
      zIndex: 1000,
    }}>
      {(!isMobile || isOpen) && (
        <>
          <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Control Panel</h3>
          
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
          </ControlGroup>

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

          <ControlGroup title="Lighting">
            <ControlItem
              icon={<FaLightbulb />}
              label="Global Light Intensity"
              value={globalLightIntensity}
              min={0}
              max={5}
              step={0.01}
              onChange={setGlobalLightIntensity}
              displayValue={(v) => v.toFixed(2)}
            />
          </ControlGroup>

          <button onClick={resetToDefaults} style={{ width: '100%', padding: '10px', marginTop: '20px', marginBottom: '20px' }}>
            <FaUndo style={{ marginRight: '10px' }} />
            Reset to Defaults
          </button>

          <ControlGroup title="Presets">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {presets.map((preset, index) => (
                <button key={index} onClick={() => applyPreset(preset.settings)} style={{ flex: '1 0 45%', padding: '5px' }}>
                  {preset.name}
                </button>
              ))}
            </div>
          </ControlGroup>
        </>
      )}
    </div>
  );
};

export default ControlPanel;
