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

vec4 transferFunction(float intensity) {
    float adjustedIntensity = intensity * brightness;
    float alpha = smoothstep(threshold, threshold + 0.3, adjustedIntensity) * opacity;
    return vec4(adjustedIntensity, adjustedIntensity, adjustedIntensity, alpha);
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
        // Maximum Intensity Projection
        float adjusted = maxIntensity * brightness;
        vec3 mipColor = vec3(adjusted);
        
        // Apply lighting to MIP if enabled (use last sample position for gradient)
        if (lightingEnabled == 1 && maxIntensity > 0.01) {
            // For MIP, we estimate the gradient at the brightest point
            // This is an approximation - true MIP lighting would require storing position
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
