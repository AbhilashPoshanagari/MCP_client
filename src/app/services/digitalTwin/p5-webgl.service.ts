import { Injectable, NgZone } from '@angular/core';
import p5 from 'p5';
import { VirtualMobileRotation } from './device-motion.model';

@Injectable({ providedIn: 'root' })
export class P5WebGLService {
    private sketch?: p5;
    private shader?: p5.Shader;
    private rotation: VirtualMobileRotation = { x: 0, y: 0, z: 0 };
    private isHovering: boolean = false;
    private hoverRotation: VirtualMobileRotation = { x: 0, y: 0, z: 0 };

    constructor(private ngZone: NgZone) { }

    // NEW: quick capability check so callers can show a fallback UI instead
    // of hitting a silent WebGL/shader failure on unsupported devices.
    isWebGLSupported(): boolean {
        try {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch {
            return false;
        }
    }

    createVirtualMobile(container: HTMLElement): void {
        if (!this.isWebGLSupported()) {
            throw new Error('WebGL is not supported on this device/browser.');
        }
        this.ngZone.runOutsideAngular(() => {
          try {
            const sketch = (p: p5) => {
                let mobileShader: p5.Shader;
                let backgroundShader: p5.Shader;
                let glowShader: p5.Shader;
                let time: number = 0;
                let mouseX: number = 0;
                let mouseY: number = 0;

                p.setup = () => {
                    const canvas = p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL);
                    canvas.parent(container);
                    p.pixelDensity(Math.min(window.devicePixelRatio, 2));
                    p.perspective(p.PI / 3, container.clientWidth / container.clientHeight, 0.1, 1000);
                    
                    mobileShader = p.createShader(this.getVertexShader(), this.getFragmentShader());
                    backgroundShader = p.createShader(this.getBackgroundVertexShader(), this.getBackgroundFragmentShader());
                    glowShader = p.createShader(this.getBackgroundVertexShader(), this.getGlowFragmentShader());
                    this.shader = mobileShader;
                    p.noStroke();
                    p.frameRate(60);
                    
                    // Add mouse interaction
                    canvas.mouseOver(() => this.isHovering = true);
                    canvas.mouseOut(() => this.isHovering = false);
                    canvas.mouseMoved(() => {
                        mouseX = (p.mouseX / p.width - 0.5) * 2;
                        mouseY = (p.mouseY / p.height - 0.5) * 2;
                    });
                };

                p.draw = () => {
                    time += 0.005;
                    
                    // Draw animated background with glow
                    p.push();
                    p.translate(0, 0, -500);
                    
                    // Main background
                    p.shader(backgroundShader);
                    backgroundShader.setUniform('uTime', time);
                    backgroundShader.setUniform('uResolution', [p.width, p.height]);
                    backgroundShader.setUniform('uMouse', [mouseX, mouseY]);
                    p.rectMode(p.CENTER);
                    p.rect(0, 0, p.width * 2, p.height * 2);
                    
                    // Glow layer
                    p.shader(glowShader);
                    glowShader.setUniform('uTime', time);
                    glowShader.setUniform('uResolution', [p.width, p.height]);
                    glowShader.setUniform('uMouse', [mouseX, mouseY]);
                    p.rect(0, 0, p.width * 2, p.height * 2);
                    
                    p.pop();
                    
                    // Draw mobile with shader
                    if (!mobileShader) return;

                    // Add slight hover animation
                    const hoverX = this.isHovering ? mouseX * 0.15 : 0;
                    const hoverY = this.isHovering ? mouseY * 0.15 : 0;

                    mobileShader.setUniform('uRotationX', this.rotation.x + hoverX);
                    mobileShader.setUniform('uRotationY', this.rotation.y + hoverY);
                    mobileShader.setUniform('uRotationZ', this.rotation.z);
                    mobileShader.setUniform('uTime', time);
                    mobileShader.setUniform('uLightPosition', [300, -400, 600]);
                    mobileShader.setUniform('uViewPosition', [0, 0, 800]);
                    mobileShader.setUniform('uAmbientLight', [0.1, 0.1, 0.15]);
                    mobileShader.setUniform('uSpecularIntensity', 0.8);
                    mobileShader.setUniform('uShininess', 32.0);
                    mobileShader.setUniform('uHover', this.isHovering ? 1.0 : 0.0);
                    mobileShader.setUniform('uMouse', [mouseX, mouseY]);
                    
                    p.shader(mobileShader);
                    
                    // Draw with slight floating animation
                    const floatY = Math.sin(time * 0.5) * 5;
                    p.translate(0, floatY, 0);
                    this.drawDetailedMobile(p);
                    
                    p.resetShader();
                };
            };
            this.sketch = new p5(sketch, container);
          } catch (err) {
            console.error('P5WebGLService: failed to create sketch', err);
            throw err;
          }
        });
    }

    updateRotation(rotation: VirtualMobileRotation): void {
        this.rotation = { ...rotation };
    }

    destroy(): void {
        if (this.sketch) {
            this.sketch.remove();
            this.sketch = undefined;
        }
    }

    // FIX: previously only resized the canvas element itself, so the
    // perspective/aspect ratio stayed locked to the size at creation time
    // and was also never actually called from anywhere.
    resize(width: number, height: number): void {
        if (this.sketch && width > 0 && height > 0) {
            this.sketch.resizeCanvas(width, height);
            this.sketch.perspective(this.sketch.PI / 3, width / height, 0.1, 1000);
        }
    }

    private drawDetailedMobile(p: p5): void {
        p.push();
        
        p.translate(0, 0, 0);
        
        // --- Shadow/glow underneath ---
        p.push();
        p.translate(0, 0, -15);
        p.fill(0, 0, 0, 30);
        p.ellipse(0, 10, 200, 80);
        p.pop();
        
        // --- Main Body ---
        p.push();
        p.rotateX(p.radians(2));
        p.rotateY(p.radians(1));
        
        // Main chassis - sleek slim profile
        p.fill(28, 32, 40);
        p.box(160, 310, 9);
        
        // --- Premium metallic edge ---
        p.push();
        p.fill(60, 65, 75, 80);
        p.box(162, 312, 9.5);
        p.pop();
        
        // --- Front face with border offset ---
        p.push();
        p.translate(0, 0, 5.5);
        
        // Outer border frame - metallic
        p.fill(50, 55, 65);
        p.box(155, 305, 1.5);
        
        // Inner border (screen bezel) - dark
        p.fill(35, 40, 52);
        p.box(151, 301, 1.2);
        
        // Screen area - deep dark
        p.fill(22, 26, 40);
        p.box(147, 297, 1);
        
        // Inner screen - slightly lighter
        p.fill(28, 32, 48);
        p.box(143, 293, 0.8);
        
        // Screen reflection layer
        p.push();
        p.translate(0, -30, 0.5);
        p.fill(255, 255, 255, 8);
        p.rect(-60, -20, 120, 40, 10);
        p.pop();
        
        // --- Camera notch (top center) - Dynamic Island style ---
        p.push();
        p.translate(0, -140, 0.5);
        p.fill(12, 15, 22);
        p.rect(-30, -8, 60, 16, 8);
        p.fill(50, 60, 80);
        p.circle(-12, 0, 6);
        p.fill(20, 30, 60);
        p.circle(-12, 0, 3);
        p.fill(50, 60, 80);
        p.circle(12, 0, 4);
        p.fill(20, 30, 60);
        p.circle(12, 0, 2);
        p.pop();
        
        // --- Speaker grille (top) ---
        p.push();
        p.translate(0, -152, 0.5);
        p.fill(50, 55, 65);
        for (let i = -10; i <= 10; i += 4) {
            p.push();
            p.translate(i, 0, 0);
            p.box(1, 0.3, 0.3);
            p.pop();
        }
        p.pop();
        
        // --- Home indicator (bottom) ---
        p.push();
        p.translate(0, 140, 0.5);
        p.fill(70, 75, 85);
        p.rect(-18, -1.5, 36, 3, 2);
        p.pop();
        
        p.pop(); // End front face
        
        // --- Back camera bump ---
        p.push();
        p.translate(0, -40, -4.5);
        p.fill(35, 40, 50);
        p.circle(0, 0, 22);
        p.fill(20, 25, 35);
        p.circle(0, 0, 16);
        p.fill(12, 15, 22);
        p.circle(0, 0, 12);
        p.fill(30, 40, 70);
        p.circle(0, 0, 6);
        
        // Camera lens reflection
        p.push();
        p.translate(-3, -3, 0.5);
        p.fill(255, 255, 255, 20);
        p.circle(0, 0, 3);
        p.pop();
        p.pop();
        
        // --- Flash (back) ---
        p.push();
        p.translate(28, -22, -4.5);
        p.fill(70, 75, 85);
        p.circle(0, 0, 4);
        p.fill(255, 255, 255, 30);
        p.circle(0, 0, 2);
        p.pop();
        
        // --- Side buttons (right side) ---
        p.push();
        p.translate(80, -55, 0);
        p.fill(50, 55, 65);
        p.box(1.5, 20, 3);
        p.pop();
        
        p.push();
        p.translate(80, 15, 0);
        p.fill(50, 55, 65);
        p.box(1.5, 12, 3);
        p.pop();
        
        p.push();
        p.translate(80, 45, 0);
        p.fill(50, 55, 65);
        p.box(1.5, 12, 3);
        p.pop();
        
        // --- Bottom port ---
        p.push();
        p.translate(0, 156, -4);
        p.fill(50, 55, 65);
        p.box(25, 1.5, 2);
        p.pop();
        
        p.pop(); // End main body
        
        // --- Ambient glow ring ---
        p.push();
        p.translate(0, 0, -15);
        p.noFill();
        p.stroke(100, 150, 255, 30);
        p.strokeWeight(2);
        p.ellipse(0, 0, 220, 340);
        p.pop();
        
        p.pop();
    }

    private getBackgroundVertexShader(): string {
        return `
            precision highp float;
            attribute vec3 aPosition;
            void main() {
                gl_Position = vec4(aPosition, 1.0);
            }
        `;
    }

    private getBackgroundFragmentShader(): string {
        return `
            precision highp float;
            uniform float uTime;
            uniform vec2 uResolution;
            uniform vec2 uMouse;
            
            void main() {
                vec2 uv = gl_FragCoord.xy / uResolution;
                vec2 mouse = uMouse * 0.5 + 0.5;
                
                // Gradient colors - dark premium theme
                vec3 color1 = vec3(0.02, 0.01, 0.04);
                vec3 color2 = vec3(0.04, 0.02, 0.08);
                vec3 color3 = vec3(0.08, 0.03, 0.12);
                vec3 color4 = vec3(0.01, 0.03, 0.10);
                
                // Mouse interaction
                vec2 center = uv - mouse * 0.3;
                float dist = length(center);
                
                // Animated waves
                float wave1 = sin(uv.x * 4.0 + uTime * 0.3) * cos(uv.y * 4.0 + uTime * 0.2);
                float wave2 = sin(uv.x * 6.0 - uTime * 0.25) * sin(uv.y * 6.0 + uTime * 0.35);
                
                // Radial gradient from mouse position
                float radial = 1.0 - dist * 0.8;
                
                // Combine colors
                vec3 color = mix(color1, color2, radial);
                color = mix(color, color3, wave1 * 0.3 + 0.3);
                color = mix(color, color4, wave2 * 0.2 + 0.2);
                
                // Add subtle grid
                float gridX = abs(sin(uv.x * 20.0 + uTime * 0.05)) * 0.02;
                float gridY = abs(sin(uv.y * 20.0 + uTime * 0.04)) * 0.02;
                color += vec3(gridX + gridY) * 0.5;
                
                // Vignette
                float vignette = 1.0 - length(uv - 0.5) * 0.7;
                color *= vignette;
                
                // Mouse glow
                float glow = 0.02 / (dist + 0.01);
                color += vec3(0.1, 0.2, 0.5) * glow * 0.3;
                
                gl_FragColor = vec4(color, 1.0);
            }
        `;
    }

    private getGlowFragmentShader(): string {
        return `
            precision highp float;
            uniform float uTime;
            uniform vec2 uResolution;
            uniform vec2 uMouse;
            
            void main() {
                vec2 uv = gl_FragCoord.xy / uResolution;
                vec2 mouse = uMouse * 0.5 + 0.5;
                
                // Center glow
                float dist = length(uv - 0.5);
                float glow = exp(-dist * 3.0) * 0.3;
                
                // Animated pulse
                float pulse = 0.1 + 0.05 * sin(uTime * 0.5);
                glow *= pulse;
                
                // Mouse interaction glow
                float mouseDist = length(uv - mouse);
                float mouseGlow = exp(-mouseDist * 8.0) * 0.2;
                
                vec3 color = vec3(0.1, 0.2, 0.5) * glow;
                color += vec3(0.2, 0.3, 0.6) * mouseGlow;
                
                // Subtle rays
                for(int i = 0; i < 6; i++) {
                    float angle = float(i) * 1.047 + uTime * 0.05;
                    vec2 dir = vec2(cos(angle), sin(angle));
                    float ray = max(0.0, dot(normalize(uv - 0.5), dir));
                    ray = pow(ray, 8.0) * 0.02;
                    color += vec3(0.2, 0.3, 0.5) * ray;
                }
                
                gl_FragColor = vec4(color, 1.0);
            }
        `;
    }

    private getVertexShader(): string {
        return `
            precision highp float;
            
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            uniform float uRotationX;
            uniform float uRotationY;
            uniform float uRotationZ;
            uniform float uTime;
            uniform float uHover;
            uniform vec2 uMouse;
            
            attribute vec3 aPosition;
            attribute vec3 aNormal;
            attribute vec2 aTexCoord;
            
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vTexCoord;
            varying vec3 vViewPosition;
            varying float vHover;
            
            mat3 rotationX(float angle) {
                float s = sin(angle);
                float c = cos(angle);
                return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
            }
            
            mat3 rotationY(float angle) {
                float s = sin(angle);
                float c = cos(angle);
                return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
            }
            
            mat3 rotationZ(float angle) {
                float s = sin(angle);
                float c = cos(angle);
                return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0);
            }
            
            void main() {
                mat3 rotation = rotationZ(uRotationZ) * rotationY(uRotationY) * rotationX(uRotationX);
                
                vec3 rotatedPosition = rotation * aPosition;
                vec3 rotatedNormal = rotation * aNormal;
                
                vec4 worldPosition = uModelViewMatrix * vec4(rotatedPosition, 1.0);
                
                gl_Position = uProjectionMatrix * worldPosition;
                
                vPosition = worldPosition.xyz;
                vNormal = normalize(mat3(uModelViewMatrix) * rotatedNormal);
                vTexCoord = aTexCoord;
                vViewPosition = -worldPosition.xyz;
                vHover = uHover;
            }
        `;
    }

    private getFragmentShader(): string {
        return `
            precision highp float;
            
            uniform vec3 uLightPosition;
            uniform vec3 uViewPosition;
            uniform vec3 uAmbientLight;
            uniform float uSpecularIntensity;
            uniform float uShininess;
            uniform float uTime;
            uniform float uHover;
            uniform vec2 uMouse;
            
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vTexCoord;
            varying vec3 vViewPosition;
            varying float vHover;
            
            void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(-vPosition);
                
                vec3 lightDir = normalize(uLightPosition - vPosition);
                vec3 reflectDir = reflect(-lightDir, normal);
                
                float diff = max(dot(normal, lightDir), 0.0);
                float diffuse = 0.3 + 0.7 * diff;
                
                vec3 halfDir = normalize(lightDir + viewDir);
                float spec = pow(max(dot(normal, halfDir), 0.0), uShininess);
                float specular = spec * uSpecularIntensity;
                
                float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
                float ambientOcclusion = 0.7 + 0.3 * abs(dot(normal, vec3(0.0, 0.0, 1.0)));
                
                float isFront = smoothstep(4.0, 6.0, vPosition.z);
                float isScreen = smoothstep(5.0, 6.5, vPosition.z);
                
                vec3 bodyColor = vec3(0.10, 0.12, 0.16);
                vec3 borderColor = vec3(0.18, 0.20, 0.26);
                vec3 screenColor = vec3(0.04, 0.06, 0.14);
                vec3 highlightColor = vec3(0.3, 0.6, 1.0);
                vec3 rimColor = vec3(0.12, 0.18, 0.28);
                
                vec3 baseColor = bodyColor;
                
                float borderWidth = 0.03;
                float isBorderX = step(abs(vTexCoord.x), borderWidth) * step(vTexCoord.x, 1.0);
                float isBorderY = step(abs(vTexCoord.y), borderWidth) * step(vTexCoord.y, 1.0);
                float isBorder = max(isBorderX, isBorderY) * isFront;
                
                baseColor = mix(baseColor, borderColor, isBorder);
                
                float isScreenArea = isFront * (1.0 - isBorder);
                baseColor = mix(baseColor, screenColor, isScreenArea);
                
                float gradient = 0.85 + 0.15 * (vPosition.y / 155.0);
                baseColor *= gradient;
                
                vec3 lighting = uAmbientLight * ambientOcclusion;
                lighting += diffuse * vec3(0.8, 0.85, 0.95);
                lighting += specular * vec3(0.7, 0.8, 1.0);
                lighting += fresnel * 0.15 * rimColor;
                
                vec3 colorHighlight = highlightColor * 0.05 * (diffuse + specular);
                vec3 finalColor = baseColor * lighting + colorHighlight;
                
                // Screen glow
                if (isScreenArea > 0.5) {
                    float glow = 0.03 * (1.0 + sin(uTime * 0.5 + vPosition.x * 0.1));
                    finalColor += vec3(0.0, 0.1, 0.3) * glow;
                    
                    float screenSpec = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 64.0);
                    finalColor += vec3(0.3, 0.5, 0.8) * screenSpec * 0.2;
                    
                    // Screen reflection
                    float reflectGlow = 0.01 * (1.0 + sin(uTime * 0.3 + vPosition.y * 0.02));
                    finalColor += vec3(0.1, 0.2, 0.4) * reflectGlow;
                }
                
                // Border highlight
                if (isBorder > 0.5) {
                    float borderGlow = 0.02 * (1.0 + sin(uTime * 0.3 + vPosition.y * 0.05));
                    finalColor += vec3(0.1, 0.2, 0.3) * borderGlow;
                }
                
                // Rim lighting
                float rim = 0.1 * pow(1.0 - abs(dot(viewDir, normal)), 2.0);
                finalColor += rim * vec3(0.2, 0.3, 0.5);
                
                // Hover effect - subtle glow
                finalColor += vec3(0.1, 0.2, 0.5) * vHover * 0.05;
                
                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;
    }
}