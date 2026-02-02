import React from 'react';
import { FaRecordVinyl, FaYinYang } from 'react-icons/fa';

const FilterToggleIcons = ({ 
  textureFilters, 
  onFilterChange,
  iconSize = 24 
}) => {
  const handleGrayscaleToggle = () => {
    const newFilters = { 
      ...textureFilters, 
      isGrayscale: !textureFilters.isGrayscale 
    };
    onFilterChange(newFilters);
  };

  const handleInvertToggle = () => {
    const newFilters = { 
      ...textureFilters, 
      isInverted: !textureFilters.isInverted 
    };
    onFilterChange(newFilters);
  };

  return (
    <>
      <FaRecordVinyl
        style={{ 
          cursor: 'pointer', 
          color: textureFilters.isGrayscale ? '#3498db' : 'white',
          transition: 'color 0.2s ease'
        }}
        onClick={handleGrayscaleToggle}
        title="Toggle B&W"
        size={iconSize}
      />
      <FaYinYang
        style={{ 
          cursor: 'pointer', 
          color: textureFilters.isInverted ? '#3498db' : 'white',
          transition: 'color 0.2s ease'
        }}
        onClick={handleInvertToggle}
        title="Invert Colors"
        size={iconSize}
      />
    </>
  );
};

export default FilterToggleIcons;
