import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FaUndo, FaChevronDown, FaChevronRight } from 'react-icons/fa';

const SliceControl = ({ width = 200, height = 200, onClipPlanesChange }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [rectangle, setRectangle] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [showSliders, setShowSliders] = useState(false);

  // Convert canvas coordinates to normalized coordinates (-1 to 1)
  const normalizeCoords = (x, y) => {
    const guideRect = getFrameGuideRect();
    
    // Convert to coordinates relative to the guide rectangle center
    const relativeX = x - (guideRect.x + guideRect.width / 2);
    const relativeY = y - (guideRect.y + guideRect.height / 2);
    
    // Normalize based on guide rectangle dimensions
    return {
      x: relativeX / (guideRect.width / 2),
      y: -relativeY / (guideRect.height / 2) // Flip Y coordinate
    };
  };

  const getHandles = useCallback(() => {
    if (!rectangle) return [];

    const x1 = rectangle.x;
    const x2 = rectangle.x + rectangle.width;
    const y1 = rectangle.y;
    const y2 = rectangle.y + rectangle.height;

    // Calculate actual positions
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);

    // Determine handle types based on their actual positions in space
    return [
      // Top-left corner is always the leftmost and topmost point
      { x: left, y: top, type: 'topleft' },
      // Top-right corner is always the rightmost and topmost point
      { x: right, y: top, type: 'topright' },
      // Bottom-right corner is always the rightmost and bottommost point
      { x: right, y: bottom, type: 'bottomright' },
      // Bottom-left corner is always the leftmost and bottommost point
      { x: left, y: bottom, type: 'bottomleft' },
      // Edge midpoints
      { x: (left + right) / 2, y: top, type: 'top' },
      { x: right, y: (top + bottom) / 2, type: 'right' },
      { x: (left + right) / 2, y: bottom, type: 'bottom' },
      { x: left, y: (top + bottom) / 2, type: 'left' }
    ];
  }, [rectangle]);

  const handleMouseMove = (e) => {
    if (!isDrawing && !isDragging) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const scaleX = width / canvasRect.width;
      const scaleY = height / canvasRect.height;
      const x = (e.clientX - canvasRect.left) * scaleX;
      const y = (e.clientY - canvasRect.top) * scaleY;

      if (rectangle) {
        const handles = getHandles();
        const handle = handles.find(h => 
          Math.sqrt(Math.pow(h.x - x, 2) + Math.pow(h.y - y, 2)) < 15
        );
        
        if (handle) {
          switch (handle.type) {
            case 'left':
            case 'right':
              canvasRef.current.style.cursor = 'ew-resize';
              break;
            case 'top':
            case 'bottom':
              canvasRef.current.style.cursor = 'ns-resize';
              break;
            case 'topleft':
            case 'bottomright':
              canvasRef.current.style.cursor = 'nwse-resize';
              break;
            case 'topright':
            case 'bottomleft':
              canvasRef.current.style.cursor = 'nesw-resize';
              break;
            default:
              canvasRef.current.style.cursor = 'grab';
          }
        } else {
          canvasRef.current.style.cursor = 'default';
        }
      }
      return;
    }

    // When dragging, use the grabbing cursor
    if (isDragging) {
      canvasRef.current.style.cursor = 'grabbing';
    }

    // Get the canvas's bounding rectangle once
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    // Calculate the scale factors between canvas coordinates and CSS pixels
    const scaleX = width / canvasRect.width;
    const scaleY = height / canvasRect.height;
    
    // Get precise coordinates
    const x = (e.clientX - canvasRect.left) * scaleX;
    const y = (e.clientY - canvasRect.top) * scaleY;

    if (isDrawing) {
      // Allow free drawing - no restrictions
      setRectangle(prev => ({
        ...prev,
        width: x - prev.x,
        height: y - prev.y
      }));
    } else if (isDragging) {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;

      setRectangle(prev => {
        const x1 = prev.x;
        const x2 = prev.x + prev.width;
        const y1 = prev.y;
        const y2 = prev.y + prev.height;

        // Determine which point we're actually dragging based on position
        const isLeft = Math.abs(x1 - dragStart.x) < Math.abs(x2 - dragStart.x);
        const isTop = Math.abs(y1 - dragStart.y) < Math.abs(y2 - dragStart.y);

        const newRect = { ...prev };

        // Handle corner and edge dragging based on actual position
        if (dragHandle.includes('left') || dragHandle.includes('right')) {
          if (isLeft) {
            newRect.x += dx;
            newRect.width -= dx;
          } else {
            newRect.width += dx;
          }
        }

        if (dragHandle.includes('top') || dragHandle.includes('bottom')) {
          if (isTop) {
            newRect.y += dy;
            newRect.height -= dy;
          } else {
            newRect.height += dy;
          }
        }

        return newRect;
      });
      setDragStart({ x, y });
    }

    // Convert rectangle to clip planes based on actual positions, not drawing order
    if (rectangle) {
      const x1 = rectangle.x;
      const x2 = rectangle.x + rectangle.width;
      const y1 = rectangle.y;
      const y2 = rectangle.y + rectangle.height;

      // Always use leftmost point for left plane, rightmost for right plane, etc.
      const normalized = {
        left: normalizeCoords(Math.min(x1, x2), 0).x,
        right: normalizeCoords(Math.max(x1, x2), 0).x,
        top: normalizeCoords(0, Math.min(y1, y2)).y,
        bottom: normalizeCoords(0, Math.max(y1, y2)).y
      };
      
      onClipPlanesChange(normalized);
    }
  };

  const handleMouseDown = (e) => {
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const scaleX = width / canvasRect.width;
    const scaleY = height / canvasRect.height;
    const x = (e.clientX - canvasRect.left) * scaleX;
    const y = (e.clientY - canvasRect.top) * scaleY;

    if (rectangle) {
      // Check if clicking on a handle
      const handles = getHandles();
      const handle = handles.find(h => 
        Math.sqrt(Math.pow(h.x - x, 2) + Math.pow(h.y - y, 2)) < 15
      );

      if (handle) {
        setIsDragging(true);
        setDragHandle(handle.type);
        setDragStart({ x, y });
        canvasRef.current.style.cursor = 'grabbing';  // Change to grabbing when dragging
        return;
      }
    }

    setIsDrawing(true);
    setRectangle({
      x,
      y,
      width: 0,
      height: 0
    });
    canvasRef.current.style.cursor = 'crosshair';
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setIsDragging(false);
    setDragHandle(null);
    canvasRef.current.style.cursor = 'default';
  };

  // Add frame aspect ratio constant
  const FRAME_ASPECT_RATIO = 1.6;

  // Calculate the frame guide dimensions to maintain aspect ratio
  const getFrameGuideRect = useCallback(() => {
    const margin = 0.1; // Changed from 0.2 to 0.1 (10% margin instead of 20%)
    const availableWidth = width * (1 - 2 * margin);
    const availableHeight = height * (1 - 2 * margin);

    let guideWidth, guideHeight;
    
    // Calculate dimensions to fit while maintaining aspect ratio
    if (availableWidth / availableHeight > FRAME_ASPECT_RATIO) {
      // Height is the limiting factor
      guideHeight = availableHeight;
      guideWidth = guideHeight * FRAME_ASPECT_RATIO;
    } else {
      // Width is the limiting factor
      guideWidth = availableWidth;
      guideHeight = guideWidth / FRAME_ASPECT_RATIO;
    }

    // Center the guide rectangle
    const x = (width - guideWidth) / 2;
    const y = (height - guideHeight) / 2;

    return {
      x,
      y,
      width: guideWidth,
      height: guideHeight
    };
  }, [width, height]);

  useEffect(() => {
    const guideRect = getFrameGuideRect();
    setRectangle(guideRect);
  }, [getFrameGuideRect]);

  useEffect(() => {
    const draw = () => {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, width, height);

      // Draw background grid
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }

      // Draw frame guide rectangle
      const guideRect = getFrameGuideRect();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.strokeRect(guideRect.x, guideRect.y, guideRect.width, guideRect.height);

      // Add frame guide label
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Frame Bounds', width / 2, guideRect.y - 5);

      // Draw user's rectangle if it exists
      if (rectangle) {
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          rectangle.x,
          rectangle.y,
          rectangle.width,
          rectangle.height
        );

        // Draw handles
        const handles = getHandles();
        ctx.fillStyle = '#3498db';
        handles.forEach(handle => {
          ctx.beginPath();
          ctx.arc(handle.x, handle.y, 5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    };

    draw();
  }, [rectangle, width, height, getHandles, getFrameGuideRect]);

  // Add reset function
  const handleReset = useCallback(() => {
    const guideRect = getFrameGuideRect();
    setRectangle(guideRect);
    onClipPlanesChange({
      left: -1,
      right: 1,
      top: 1,
      bottom: -1
    });
  }, [getFrameGuideRect, onClipPlanesChange]);

  // Add slider controls
  const renderSliders = () => (
    <div style={{
      marginTop: '10px',
      padding: '10px',
      backgroundColor: '#333',
      borderRadius: '4px',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ color: '#fff', display: 'block', marginBottom: '5px' }}>Left</label>
        <input
          type="range"
          min={0}
          max={width}
          value={rectangle?.x || 0}
          onChange={(e) => {
            const newX = parseFloat(e.target.value);
            setRectangle(prev => {
              const newRect = {
                ...prev,
                width: (prev.x + prev.width) - newX,
                x: newX
              };
              
              // Update clip planes
              onClipPlanesChange({
                left: normalizeCoords(Math.min(newRect.x, newRect.x + newRect.width), 0).x,
                right: normalizeCoords(Math.max(newRect.x, newRect.x + newRect.width), 0).x,
                top: normalizeCoords(0, Math.min(newRect.y, newRect.y + newRect.height)).y,
                bottom: normalizeCoords(0, Math.max(newRect.y, newRect.y + newRect.height)).y
              });
              
              return newRect;
            });
          }}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ color: '#fff', display: 'block', marginBottom: '5px' }}>Right</label>
        <input
          type="range"
          min={0}
          max={width}
          value={(rectangle?.x || 0) + (rectangle?.width || 0)}
          onChange={(e) => {
            const newRight = parseFloat(e.target.value);
            setRectangle(prev => {
              const newRect = {
                ...prev,
                width: newRight - prev.x
              };
              
              // Update clip planes
              onClipPlanesChange({
                left: normalizeCoords(Math.min(newRect.x, newRect.x + newRect.width), 0).x,
                right: normalizeCoords(Math.max(newRect.x, newRect.x + newRect.width), 0).x,
                top: normalizeCoords(0, Math.min(newRect.y, newRect.y + newRect.height)).y,
                bottom: normalizeCoords(0, Math.max(newRect.y, newRect.y + newRect.height)).y
              });
              
              return newRect;
            });
          }}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ color: '#fff', display: 'block', marginBottom: '5px' }}>Top</label>
        <input
          type="range"
          min={0}
          max={height}
          value={rectangle?.y || 0}
          onChange={(e) => {
            const newY = parseFloat(e.target.value);
            setRectangle(prev => {
              const newRect = {
                ...prev,
                height: (prev.y + prev.height) - newY,
                y: newY
              };
              
              // Update clip planes
              onClipPlanesChange({
                left: normalizeCoords(Math.min(newRect.x, newRect.x + newRect.width), 0).x,
                right: normalizeCoords(Math.max(newRect.x, newRect.x + newRect.width), 0).x,
                top: normalizeCoords(0, Math.min(newRect.y, newRect.y + newRect.height)).y,
                bottom: normalizeCoords(0, Math.max(newRect.y, newRect.y + newRect.height)).y
              });
              
              return newRect;
            });
          }}
          style={{ width: '100%' }}
        />
      </div>
      <div>
        <label style={{ color: '#fff', display: 'block', marginBottom: '5px' }}>Bottom</label>
        <input
          type="range"
          min={0}
          max={height}
          value={(rectangle?.y || 0) + (rectangle?.height || 0)}
          onChange={(e) => {
            const newBottom = parseFloat(e.target.value);
            setRectangle(prev => {
              const newRect = {
                ...prev,
                height: newBottom - prev.y
              };
              
              // Update clip planes
              onClipPlanesChange({
                left: normalizeCoords(Math.min(newRect.x, newRect.x + newRect.width), 0).x,
                right: normalizeCoords(Math.max(newRect.x, newRect.x + newRect.width), 0).x,
                top: normalizeCoords(0, Math.min(newRect.y, newRect.y + newRect.height)).y,
                bottom: normalizeCoords(0, Math.max(newRect.y, newRect.y + newRect.height)).y
              });
              
              return newRect;
            });
          }}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            cursor: 'pointer' 
          }}
          onClick={() => setShowSliders(!showSliders)}
        >
          {showSliders ? <FaChevronDown /> : <FaChevronRight />}
          <span style={{ marginLeft: '5px' }}>Precise Control</span>
        </div>
        <FaUndo 
          style={{ cursor: 'pointer' }} 
          onClick={handleReset}
          title="Reset to Frame Bounds"
        />
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          background: '#222',
          border: '1px solid #444',
          borderRadius: '4px'
        }}
      />
      {showSliders && renderSliders()}
    </div>
  );
};

export default SliceControl;
