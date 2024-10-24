import React, { useRef, useEffect, useState, useCallback } from 'react';
import { FaUndo, FaChevronDown, FaChevronRight } from 'react-icons/fa';

const SliceControl = ({ width = 200, height = 200, onClipPlanesChange }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [rectangle, setRectangle] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [showSliders, setShowSliders] = useState(false);
  const [debouncedRectangle, setDebouncedRectangle] = useState(null);
  const initialHandleType = useRef(null);
  const lastNormalizedBounds = useRef({
    left: -1,
    right: 1,
    top: 1,
    bottom: -1
  });

  // Add frame aspect ratio constant
  const FRAME_ASPECT_RATIO = 1.6;

  // Add function to get canvas coordinates
  const getCanvasCoordinates = useCallback((clientX, clientY) => {
    const canvasRect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - canvasRect.left) * (width / canvasRect.width),
      y: (clientY - canvasRect.top) * (height / canvasRect.height)
    };
  }, [width, height]);

  // First, define getFrameGuideRect
  const getFrameGuideRect = useCallback(() => {
    const margin = 0.1;
    const availableWidth = width * (1 - 2 * margin);
    const availableHeight = height * (1 - 2 * margin);

    let guideWidth, guideHeight;
    
    if (availableWidth / availableHeight > FRAME_ASPECT_RATIO) {
      guideHeight = availableHeight;
      guideWidth = guideHeight * FRAME_ASPECT_RATIO;
    } else {
      guideWidth = availableWidth;
      guideHeight = guideWidth / FRAME_ASPECT_RATIO;
    }

    const x = (width - guideWidth) / 2;
    const y = (height - guideHeight) / 2;

    return {
      x,
      y,
      width: guideWidth,
      height: guideHeight
    };
  }, [width, height]);

  // Second, define normalizeCoords
  const normalizeCoords = useCallback((x, y) => {
    const guideRect = getFrameGuideRect();
    
    const relativeX = x - (guideRect.x + guideRect.width / 2);
    const relativeY = y - (guideRect.y + guideRect.height / 2);
    
    return {
      x: relativeX / (guideRect.width / 2),
      y: -relativeY / (guideRect.height / 2)
    };
  }, [getFrameGuideRect]);

  // Third, define updateClipPlanes
  const updateClipPlanes = useCallback((rect) => {
    if (!rect) return;

    const x1 = rect.x;
    const x2 = rect.x + rect.width;
    const y1 = rect.y;
    const y2 = rect.y + rect.height;

    const normalized = {
      left: normalizeCoords(Math.min(x1, x2), 0).x,
      right: normalizeCoords(Math.max(x1, x2), 0).x,
      top: normalizeCoords(0, Math.min(y1, y2)).y,
      bottom: normalizeCoords(0, Math.max(y1, y2)).y
    };

    lastNormalizedBounds.current = normalized;
    onClipPlanesChange(normalized);
  }, [normalizeCoords, onClipPlanesChange]);

  // Fourth, define getHandles
  const getHandles = useCallback(() => {
    if (!rectangle) return [];

    const x1 = rectangle.x;
    const x2 = rectangle.x + rectangle.width;
    const y1 = rectangle.y;
    const y2 = rectangle.y + rectangle.height;

    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);

    return [
      { x: left, y: top, type: 'topleft' },
      { x: right, y: top, type: 'topright' },
      { x: right, y: bottom, type: 'bottomright' },
      { x: left, y: bottom, type: 'bottomleft' },
      { x: (left + right) / 2, y: top, type: 'top' },
      { x: right, y: (top + bottom) / 2, type: 'right' },
      { x: (left + right) / 2, y: bottom, type: 'bottom' },
      { x: left, y: (top + bottom) / 2, type: 'left' }
    ];
  }, [rectangle]);

  const handleMouseMove = (e) => {
    if (!isDrawing && !isDragging) {
      const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);

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

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);

    if (isDrawing) {
      setRectangle(prev => {
        const newRect = {
          ...prev,
          width: x - prev.x,
          height: y - prev.y
        };
        updateClipPlanes(newRect);
        return newRect;
      });
    } else if (isDragging) {
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;

      setRectangle(prev => {
        const newRect = { ...prev };
        const handleType = initialHandleType.current || '';

        // Simple direct movement based on handle type
        if (handleType.includes('left')) {
          newRect.x = dragStart.originalRect.x + dx;
          newRect.width = dragStart.originalRect.width - dx;
        } else if (handleType.includes('right')) {
          newRect.width = dragStart.originalRect.width + dx;
        }

        if (handleType.includes('top')) {
          newRect.y = dragStart.originalRect.y + dy;
          newRect.height = dragStart.originalRect.height - dy;
        } else if (handleType.includes('bottom')) {
          newRect.height = dragStart.originalRect.height + dy;
        }

        updateClipPlanes(newRect);
        return newRect;
      });
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
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);

    if (rectangle) {
      const handles = getHandles();
      const handle = handles.find(h => 
        Math.sqrt(Math.pow(h.x - x, 2) + Math.pow(h.y - y, 2)) < 15
      );

      if (handle) {
        setIsDragging(true);
        initialHandleType.current = handle.type;
        setDragStart({
          x,
          y,
          originalRect: { ...rectangle }  // Store the initial rectangle state
        });
        canvasRef.current.style.cursor = 'grabbing';
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
    initialHandleType.current = null;
    canvasRef.current.style.cursor = 'default';
  };

  useEffect(() => {
    const guideRect = getFrameGuideRect();
    setRectangle(guideRect);
    updateClipPlanes(guideRect);
  }, [getFrameGuideRect, updateClipPlanes]);

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
    updateClipPlanes(guideRect);
  }, [getFrameGuideRect, updateClipPlanes]);

  // Update clip planes when debounced rectangle changes
  useEffect(() => {
    if (debouncedRectangle) {
      const x1 = debouncedRectangle.x;
      const x2 = debouncedRectangle.x + debouncedRectangle.width;
      const y1 = debouncedRectangle.y;
      const y2 = debouncedRectangle.y + debouncedRectangle.height;

      const normalized = {
        left: normalizeCoords(Math.min(x1, x2), 0).x,
        right: normalizeCoords(Math.max(x1, x2), 0).x,
        top: normalizeCoords(0, Math.min(y1, y2)).y,
        bottom: normalizeCoords(0, Math.max(y1, y2)).y
      };
      
      onClipPlanesChange(normalized);
    }
  }, [debouncedRectangle, onClipPlanesChange, normalizeCoords]);

  // Update debounced rectangle whenever the actual rectangle changes
  useEffect(() => {
    setDebouncedRectangle(rectangle);
  }, [rectangle]);

  // Add a flag to track slider updates
  const isSliderUpdating = useRef(false);

  // Modify the effect that updates clip planes
  useEffect(() => {
    if (rectangle && !isDrawing && !isDragging && !isSliderUpdating.current) {
      updateClipPlanes(rectangle);
    }
  }, [rectangle, isDrawing, isDragging, updateClipPlanes]);

  const handleSliderChange = (updateFn) => {
    isSliderUpdating.current = true;
    updateFn();
    // Use RAF to ensure we complete the current update cycle
    requestAnimationFrame(() => {
      isSliderUpdating.current = false;
      if (rectangle) {
        updateClipPlanes(rectangle);
      }
    });
  };

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
            handleSliderChange(() => {
              setRectangle(prev => ({
                ...prev,
                width: (prev.x + prev.width) - newX,
                x: newX
              }));
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
            handleSliderChange(() => {
              setRectangle(prev => ({
                ...prev,
                width: newRight - prev.x
              }));
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
            handleSliderChange(() => {
              setRectangle(prev => ({
                ...prev,
                height: (prev.y + prev.height) - newY,
                y: newY
              }));
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
            handleSliderChange(() => {
              setRectangle(prev => ({
                ...prev,
                height: newBottom - prev.y
              }));
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
