# Volume Rendering Testing Guide

## Overview

This guide explains how to test the new ray marching volume rendering feature for the 3D ultrasound visualizer.

## Getting Started

1. **Start the app**: The dev server should be running at `http://localhost:3000`
2. **Load a video**: Click the folder icon or drag & drop an ultrasound video file

## New Controls

After loading a video and waiting for frame extraction to complete, you'll find new controls in the right panel:

### Render Mode Dropdown
- **Stacked Planes** (default): The original rendering method using overlapping transparent planes
- **Volume Rendering**: The new ray marching technique that renders the data as a true 3D volume

### Volume-Specific Controls (visible when "Volume Rendering" is selected)

| Control | Range | Description |
|---------|-------|-------------|
| **Volume Type** | Accumulate / Max Intensity | Accumulate blends all samples; MIP shows brightest value along each ray |
| **Threshold** | 0 - 0.5 | Controls visibility cutoff - higher values hide darker regions |
| **Quality** | 0.001 - 0.02 | Ray march step size - smaller = better quality but slower |

## What to Expect

### Stacked Planes Mode (Original)
- Frames appear as transparent planes stacked in 3D space
- View-dependent: appearance changes significantly as you rotate
- Bright regions accumulate when overlapping (especially in "Add" blend mode)

### Volume Rendering Mode (New)
- Data rendered as a cohesive 3D volume
- **View-independent**: Structure looks consistent from all angles
- Ray marching traces rays through the volume, sampling and compositing colors
- More accurate representation of the actual 3D data

## Testing Scenarios

### Basic Test
1. Load any ultrasound video
2. Wait for extraction to complete
3. Switch to "Volume Rendering" mode
4. Rotate the view - the volume should maintain its structure

### Threshold Test
1. In Volume mode, set threshold to 0 (shows everything)
2. Gradually increase threshold to hide dark/noise regions
3. Useful for isolating bright structures

### Quality Test
1. Set Quality to 0.02 (fast, lower quality)
2. Rotate and observe any banding artifacts
3. Set Quality to 0.001 (slow, highest quality)
4. Notice smoother gradients but potentially slower rendering

### MIP Mode Test
1. Switch Volume Type to "Max Intensity (MIP)"
2. This shows the brightest value along each ray
3. Good for seeing bright structures through the volume
4. Compare to "Accumulate" mode which blends all values

## Troubleshooting

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| Black/empty volume | Threshold too high | Lower the threshold value |
| Very dim volume | Brightness too low | Increase brightness slider |
| Slow rendering | Quality set too high | Increase step size (lower quality) |
| No volume visible | Volume not initialized | Reload the video |

## Technical Notes

- Volume rendering uses WebGL2 3D textures
- Frames are converted to grayscale and packed into a 3D texture
- Ray marching samples the texture along camera rays
- Front-to-back compositing accumulates color and opacity
- Camera position is updated every frame for correct ray directions

## Performance Tips

- Start with Quality at 0.01 for a balance of speed/quality
- Use MIP mode for faster rendering of bright structures
- Higher threshold values improve performance by skipping samples
- The volume is scaled to match the original frame aspect ratio
