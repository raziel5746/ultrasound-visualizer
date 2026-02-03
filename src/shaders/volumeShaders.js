export const volumeVertexShader = `
precision highp float;

attribute vec3 position;

uniform mat4 world;
uniform mat4 worldViewProjection;
uniform vec3 cameraPosition;
uniform vec3 volumeScale;

varying vec3 vRayDir;
varying vec3 vPosition;
varying vec3 vTransformedEye;

void main() {
    gl_Position = worldViewProjection * vec4(position, 1.0);
    
    // Transform box coordinates from [-0.5, 0.5] to [0, 1] for texture sampling
    vPosition = position + 0.5;
    
    // Transform camera position to local object space, then to [0, 1] range
    vec3 localEye = (inverse(world) * vec4(cameraPosition, 1.0)).xyz;
    vTransformedEye = localEye + 0.5;
    
    // Ray direction in [0, 1] space
    vRayDir = vPosition - vTransformedEye;
}
`;

export const volumeFragmentShader = `
precision highp float;
precision highp sampler3D;

uniform sampler3D volumeTexture;
uniform float stepSize;
uniform float opacity;
uniform float brightness;
uniform float threshold;
uniform vec3 volumeDimensions;
uniform int maxSteps;
uniform int renderMode; // 0 = accumulate, 1 = MIP
uniform vec3 clipMin;   // Clipping bounds min (0-1)
uniform vec3 clipMax;   // Clipping bounds max (0-1)

// Lighting uniforms
uniform int lightingEnabled;
uniform float ambient;
uniform float diffuse;
uniform float specular;
uniform float shininess;

// Transfer function uniform
uniform int transferFunctionType; // 0=grayscale, 1=heat, 2=cool, 3=bone, 4=copper, 5=viridis, 6=plasma, 7=rainbow

varying vec3 vRayDir;
varying vec3 vPosition;
varying vec3 vTransformedEye;

vec2 intersectBox(vec3 orig, vec3 dir) {
    vec3 boxMin = vec3(0.0);
    vec3 boxMax = vec3(1.0);
    vec3 invDir = 1.0 / dir;
    vec3 tMin = (boxMin - orig) * invDir;
    vec3 tMax = (boxMax - orig) * invDir;
    vec3 t1 = min(tMin, tMax);
    vec3 t2 = max(tMin, tMax);
    float tNear = max(max(t1.x, t1.y), t1.z);
    float tFar = min(min(t2.x, t2.y), t2.z);
    return vec2(tNear, tFar);
}

// Compute gradient (normal) using central differences
vec3 computeGradient(vec3 pos) {
    float h = 1.0 / volumeDimensions.x; // Sample offset
    float dx = texture(volumeTexture, pos + vec3(h, 0.0, 0.0)).r - texture(volumeTexture, pos - vec3(h, 0.0, 0.0)).r;
    float dy = texture(volumeTexture, pos + vec3(0.0, h, 0.0)).r - texture(volumeTexture, pos - vec3(0.0, h, 0.0)).r;
    float dz = texture(volumeTexture, pos + vec3(0.0, 0.0, h)).r - texture(volumeTexture, pos - vec3(0.0, 0.0, h)).r;
    return vec3(dx, dy, dz);
}

// Phong lighting calculation
vec3 applyLighting(vec3 baseColor, vec3 normal, vec3 viewDir, vec3 lightDir) {
    // Normalize the gradient to get surface normal
    float gradMag = length(normal);
    if (gradMag < 0.001) {
        // No gradient = flat area, just use ambient
        return baseColor * ambient;
    }
    vec3 N = normalize(normal);
    vec3 L = normalize(lightDir);
    vec3 V = normalize(viewDir);
    vec3 R = reflect(-L, N);
    
    // Ambient component
    vec3 ambientColor = baseColor * ambient;
    
    // Diffuse component (Lambertian)
    float diff = max(dot(N, L), 0.0);
    vec3 diffuseColor = baseColor * diffuse * diff;
    
    // Specular component (Blinn-Phong)
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), shininess);
    vec3 specularColor = vec3(1.0) * specular * spec;
    
    return ambientColor + diffuseColor + specularColor;
}

// Apply color map based on transfer function type
vec3 applyColorMap(float t) {
    t = clamp(t, 0.0, 1.0);
    
    if (transferFunctionType == 1) {
        // Heat: black -> red -> yellow -> white
        return vec3(
            clamp(t * 3.0, 0.0, 1.0),
            clamp(t * 3.0 - 1.0, 0.0, 1.0),
            clamp(t * 3.0 - 2.0, 0.0, 1.0)
        );
    } else if (transferFunctionType == 2) {
        // Cool: black -> blue -> cyan -> white
        return vec3(
            clamp(t * 3.0 - 2.0, 0.0, 1.0),
            clamp(t * 3.0 - 1.0, 0.0, 1.0),
            clamp(t * 3.0, 0.0, 1.0)
        );
    } else if (transferFunctionType == 3) {
        // Bone: blue-tinted grayscale
        return vec3(
            t * 0.99,
            t * 0.99,
            t * 0.99 + (1.0 - t) * 0.08
        );
    } else if (transferFunctionType == 4) {
        // Copper: black -> orange -> peach
        return vec3(
            clamp(t * 1.25, 0.0, 1.0),
            clamp(t * 0.78, 0.0, 1.0),
            clamp(t * 0.5, 0.0, 1.0)
        );
    } else if (transferFunctionType == 5) {
        // Viridis: purple -> blue -> green -> yellow
        vec3 c0 = vec3(0.267, 0.004, 0.329);
        vec3 c1 = vec3(0.282, 0.140, 0.457);
        vec3 c2 = vec3(0.127, 0.566, 0.550);
        vec3 c3 = vec3(0.993, 0.906, 0.144);
        if (t < 0.33) return mix(c0, c1, t * 3.0);
        else if (t < 0.66) return mix(c1, c2, (t - 0.33) * 3.0);
        else return mix(c2, c3, (t - 0.66) * 3.0);
    } else if (transferFunctionType == 6) {
        // Plasma: purple -> pink -> orange -> yellow
        vec3 c0 = vec3(0.050, 0.030, 0.527);
        vec3 c1 = vec3(0.798, 0.280, 0.470);
        vec3 c2 = vec3(0.988, 0.652, 0.250);
        vec3 c3 = vec3(0.940, 0.975, 0.131);
        if (t < 0.33) return mix(c0, c1, t * 3.0);
        else if (t < 0.66) return mix(c1, c2, (t - 0.33) * 3.0);
        else return mix(c2, c3, (t - 0.66) * 3.0);
    } else if (transferFunctionType == 7) {
        // Rainbow
        float h = t * 5.0;
        vec3 c;
        if (h < 1.0) c = vec3(1.0, h, 0.0);
        else if (h < 2.0) c = vec3(2.0 - h, 1.0, 0.0);
        else if (h < 3.0) c = vec3(0.0, 1.0, h - 2.0);
        else if (h < 4.0) c = vec3(0.0, 4.0 - h, 1.0);
        else c = vec3(h - 4.0, 0.0, 1.0);
        return c;
    }
    
    // Default: grayscale
    return vec3(t, t, t);
}

vec4 transferFunction(float intensity) {
    float adjustedIntensity = intensity * brightness;
    float alpha = smoothstep(threshold, threshold + 0.3, adjustedIntensity) * opacity;
    vec3 color = applyColorMap(adjustedIntensity);
    return vec4(color, alpha);
}

void main() {
    vec3 rayDir = normalize(vRayDir);
    vec2 tHit = intersectBox(vTransformedEye, rayDir);
    
    if (tHit.x > tHit.y) {
        discard;
    }
    
    tHit.x = max(tHit.x, 0.0);
    
    vec4 accumulatedColor = vec4(0.0);
    float maxIntensity = 0.0;
    
    float t = tHit.x;
    float tEnd = tHit.y;
    float rayLength = tEnd - tHit.x;
    
    // Adaptive step size based on ray length
    float adaptiveStep = rayLength / float(maxSteps);
    float actualStep = max(stepSize, adaptiveStep);
    
    for (int i = 0; i < 512; i++) {
        if (i >= maxSteps) break;
        if (t >= tEnd) break;
        
        vec3 samplePos = vTransformedEye + rayDir * t;
        
        // Clamp sample position to valid range and flip Y to fix upside-down
        samplePos = clamp(samplePos, vec3(0.001), vec3(0.999));
        samplePos.y = 1.0 - samplePos.y;  // Flip Y axis
        
        // Apply clipping bounds - skip samples outside the clip region
        if (samplePos.x < clipMin.x || samplePos.x > clipMax.x ||
            samplePos.y < clipMin.y || samplePos.y > clipMax.y ||
            samplePos.z < clipMin.z || samplePos.z > clipMax.z) {
            t += actualStep;
            continue;
        }
        
        float intensity = texture(volumeTexture, samplePos).r;
        
        if (renderMode == 1) {
            // Maximum Intensity Projection
            maxIntensity = max(maxIntensity, intensity);
        } else {
            // Front-to-back compositing
            vec4 sampleColor = transferFunction(intensity);
            
            // Apply lighting if enabled
            if (lightingEnabled == 1 && sampleColor.a > 0.01) {
                vec3 gradient = computeGradient(samplePos);
                vec3 viewDir = -rayDir;
                vec3 lightDir = viewDir; // Headlight: light from camera direction
                sampleColor.rgb = applyLighting(sampleColor.rgb, gradient, viewDir, lightDir);
            }
            
            accumulatedColor.rgb += (1.0 - accumulatedColor.a) * sampleColor.rgb * sampleColor.a;
            accumulatedColor.a += (1.0 - accumulatedColor.a) * sampleColor.a;
            
            if (accumulatedColor.a > 0.95) break;
        }
        
        t += actualStep;
    }
    
    if (renderMode == 1) {
        // Maximum Intensity Projection with color map
        float adjusted = maxIntensity * brightness;
        vec3 mipColor = applyColorMap(adjusted);
        
        // Apply lighting to MIP if enabled
        if (lightingEnabled == 1 && maxIntensity > 0.01) {
            mipColor = mipColor * (ambient + diffuse * 0.5);
        }
        
        gl_FragColor = vec4(mipColor, 1.0);
    } else {
        // Accumulate mode - discard if nothing accumulated
        if (accumulatedColor.a < 0.01) {
            discard;
        }
        gl_FragColor = accumulatedColor;
    }
}
`;
