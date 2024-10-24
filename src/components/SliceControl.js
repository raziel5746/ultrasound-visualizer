import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { FaUndo, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { throttle } from 'lodash';

const SliceControl = ({ width = 200, height = 200, onClipPlanesChange }) => {
  const canvasRef = useRef(null);
  const throttledFunctionRef = useRef(null);  // Renamed to avoid conflict
  const [isDrawing, setIsDrawing] = useState(false);
  const [rectangle, setRectangle] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [showSliders, setShowSliders] = useState(false);
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

  // Replace the throttledClipPlanesUpdate definition with this version
  const throttledClipPlanesUpdate = useCallback((rect) => {
    // Cancel previous throttled function if it exists
    if (throttledFunctionRef.current) {
      throttledFunctionRef.current.cancel();
    }

    // Create new throttled function
    const updateClipPlanes = throttle((r) => {
      if (!r) return;

      const x1 = r.x;
      const x2 = r.x + r.width;
      const y1 = r.y;
      const y2 = r.y + r.height;

      const normalized = {
        left: normalizeCoords(Math.min(x1, x2), 0).x,
        right: normalizeCoords(Math.max(x1, x2), 0).x,
        top: normalizeCoords(0, Math.min(y1, y2)).y,
        bottom: normalizeCoords(0, Math.max(y1, y2)).y
      };

      lastNormalizedBounds.current = normalized;
      onClipPlanesChange(normalized);
    }, 16);

    // Store the new throttled function
    throttledFunctionRef.current = updateClipPlanes;
    
    // Call it with the current rect
    updateClipPlanes(rect);
  }, [normalizeCoords, onClipPlanesChange]);

  // Then keep handleMouseMove and the rest of the code as is
  const handleMouseMove = useCallback((e) => {
    if (!isDrawing && !isDragging) {
      // Handle cursor updates less frequently
      requestAnimationFrame(() => {
        const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);

        if (rectangle) {
          const handles = getHandles();
          const handle = handles.find(h => 
            Math.sqrt(Math.pow(h.x - x, 2) + Math.pow(h.y - y, 2)) < 15
          );
          
          if (handle) {
            const cursorType = {
              left: 'ew-resize',
              right: 'ew-resize',
              top: 'ns-resize',
              bottom: 'ns-resize',
              topleft: 'nwse-resize',
              bottomright: 'nwse-resize',
              topright: 'nesw-resize',
              bottomleft: 'nesw-resize'
            }[handle.type] || 'grab';
            
            canvasRef.current.style.cursor = cursorType;
          } else {
            canvasRef.current.style.cursor = 'default';
          }
        }
      });
      return;
    }

    // Use shared state for coordinates to prevent multiple calculations
    const coords = getCanvasCoordinates(e.clientX, e.clientY);

    requestAnimationFrame(() => {
      if (isDrawing) {
        setRectangle(prev => {
          const newRect = {
            ...prev,
            width: coords.x - prev.x,
            height: coords.y - prev.y
          };
          throttledClipPlanesUpdate(newRect);
          return newRect;
        });
      } else if (isDragging) {
        const dx = coords.x - dragStart.x;
        const dy = coords.y - dragStart.y;

        setRectangle(prev => {
          const newRect = { ...prev };
          const handleType = initialHandleType.current || '';
          const originalRect = dragStart.originalRect;

          // Calculate current corners
          const left = Math.min(originalRect.x, originalRect.x + originalRect.width);
          const right = Math.max(originalRect.x, originalRect.x + originalRect.width);
          const top = Math.min(originalRect.y, originalRect.y + originalRect.height);
          const bottom = Math.max(originalRect.y, originalRect.y + originalRect.height);

          // Handle corner dragging
          switch (handleType) {
            case 'topleft':
              newRect.x = left + dx;
              newRect.y = top + dy;
              newRect.width = right - newRect.x;
              newRect.height = bottom - newRect.y;
              break;
            case 'topright':
              newRect.width = (right + dx) - left;
              newRect.x = left;
              newRect.y = top + dy;
              newRect.height = bottom - newRect.y;
              break;
            case 'bottomright':
              newRect.width = (right + dx) - left;
              newRect.x = left;
              newRect.height = (bottom + dy) - top;
              newRect.y = top;
              break;
            case 'bottomleft':
              newRect.x = left + dx;
              newRect.width = right - newRect.x;
              newRect.height = (bottom + dy) - top;
              newRect.y = top;
              break;
            case 'top':
              newRect.y = top + dy;
              newRect.height = bottom - newRect.y;
              break;
            case 'right':
              newRect.width = (right + dx) - left;
              newRect.x = left;
              break;
            case 'bottom':
              newRect.height = (bottom + dy) - top;
              newRect.y = top;
              break;
            case 'left':
              newRect.x = left + dx;
              newRect.width = right - newRect.x;
              break;
            default:
              break;
          }

          // Ensure width and height are never negative
          if (newRect.width < 0) {
            newRect.x = newRect.x + newRect.width;
            newRect.width = Math.abs(newRect.width);
          }
          if (newRect.height < 0) {
            newRect.y = newRect.y + newRect.height;
            newRect.height = Math.abs(newRect.height);
          }

          throttledClipPlanesUpdate(newRect);
          return newRect;
        });
      }
    });
  }, [isDrawing, isDragging, dragStart, getCanvasCoordinates, throttledClipPlanesUpdate, rectangle, getHandles]);

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

  // Add useMemo for rectangle calculations
  const rectangleState = useMemo(() => ({
    rectangle,
    handles: getHandles(),
    guideRect: getFrameGuideRect()
  }), [rectangle, getHandles, getFrameGuideRect]);

  // Modify the draw effect to use memoized values
  useEffect(() => {
    let animationFrameId;
    let isDrawing = false;
    
    const draw = () => {
      if (!canvasRef.current || isDrawing) return;
      isDrawing = true;
      
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, width, height);

      // Draw background grid (reduce frequency of grid updates)
      if (!isDragging && !isDrawing) {
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
      }

      // Draw frame guide rectangle
      const { guideRect } = rectangleState;
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 2;
      ctx.strokeRect(guideRect.x, guideRect.y, guideRect.width, guideRect.height);

      // Add frame guide label
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Frame Bounds', width / 2, guideRect.y - 5);

      // Draw user's rectangle if it exists
      if (rectangleState.rectangle) {
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          rectangleState.rectangle.x,
          rectangleState.rectangle.y,
          rectangleState.rectangle.width,
          rectangleState.rectangle.height
        );

        // Draw handles
        ctx.fillStyle = '#3498db';
        rectangleState.handles.forEach(handle => {
          ctx.beginPath();
          ctx.arc(handle.x, handle.y, 5, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      isDrawing = false;
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [rectangleState, width, height, isDragging]);

  // Add reset function
  const handleReset = useCallback(() => {
    const guideRect = getFrameGuideRect();
    setRectangle(guideRect);
    throttledClipPlanesUpdate(guideRect);
  }, [getFrameGuideRect, throttledClipPlanesUpdate]);

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
    requestAnimationFrame(() => {
      isSliderUpdating.current = false;
      if (rectangle) {
        throttledClipPlanesUpdate(rectangle);
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

  // Update the cleanup effect
  useEffect(() => {
    return () => {
      if (throttledFunctionRef.current) {
        throttledFunctionRef.current.cancel();
      }
    };
  }, []);

  // Add this effect near the other useEffect declarations
  useEffect(() => {
    // Initialize rectangle with frame bounds on mount
    const guideRect = getFrameGuideRect();
    setRectangle(guideRect);
    updateClipPlanes(guideRect);
  }, [getFrameGuideRect, updateClipPlanes]); // Only run on mount and if frame guide rect changes

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
