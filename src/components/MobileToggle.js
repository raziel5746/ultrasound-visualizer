import React from 'react';
import { FaCog } from 'react-icons/fa';

const MobileToggle = ({ 
  isOpen, 
  onToggle 
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: isOpen ? '340px' : 0,
        left: 0,
        right: 0,
        backgroundColor: '#282c34',
        padding: '10px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        boxShadow: '0 -2px 5px rgba(0,0,0,0.2)',
        zIndex: 1001,
        transition: 'bottom 0.2s ease-in-out',
        color: '#ffffff',
        borderTop: '1px solid #404040'
      }}
      onClick={onToggle}
    >
      <FaCog style={{ marginRight: '10px', color: '#3498db' }} />
      {isOpen ? 'Hide Controls' : 'Show Controls'}
    </div>
  );
};

export default MobileToggle;
