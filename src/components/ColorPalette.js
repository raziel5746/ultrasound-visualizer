import React from 'react';

const ColorPalette = ({ colors, selectedColor, onColorSelect }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      {colors.map((color, index) => (
        <div
          key={index}
          onClick={() => onColorSelect(color)}
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            backgroundColor: color,
            cursor: 'pointer',
            border: selectedColor === color ? '2px solid #fff' : 'none',
            boxShadow: selectedColor === color ? '0 0 0 2px #000' : 'none',
          }}
        />
      ))}
    </div>
  );
};

export default ColorPalette;
