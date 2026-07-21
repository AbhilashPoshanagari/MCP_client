import { Injectable, NgZone } from '@angular/core';
import p5 from 'p5';
import { VirtualMobileRotation } from './device-motion.model';

@Injectable({ providedIn: 'root' })
export class P5WebGLService {
    private sketch?: p5;
    private shader?: p5.Shader;
    private rotation: VirtualMobileRotation = { x: 0, y: 0, z: 0 };

    constructor(private ngZone: NgZone) { }

    createVirtualMobile(container: HTMLElement): void {
        this.ngZone.runOutsideAngular(() => {
            const sketch = (p: p5) => {
                let mobileShader: p5.Shader;
                p.setup = () => {
                    const canvas = p.createCanvas(container.clientWidth, container.clientHeight, p.WEBGL);
                    canvas.parent(container);
                    p.pixelDensity(Math.min(window.devicePixelRatio, 2));
                    mobileShader = p.createShader(this.getVertexShader(), this.getFragmentShader());
                    this.shader = mobileShader;
                    p.noStroke();
                };
                p.draw = () => {
                    p.background(8, 10, 18);
                    if (!mobileShader) return;
                    mobileShader.setUniform('uRotationX', this.rotation.x);
                    mobileShader.setUniform('uRotationY', this.rotation.y);
                    mobileShader.setUniform('uRotationZ', this.rotation.z);
                    mobileShader.setUniform('uLightPosition', [200, -300, 500]);
                    mobileShader.setUniform('uTime', p.millis() / 1000);
                    p.shader(mobileShader);
                    this.drawVirtualMobile(p);
                    p.resetShader();
                };
            };
            this.sketch = new p5(sketch, container);
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

    resize(width: number, height: number): void {
        if (this.sketch) {
            this.sketch.resizeCanvas(width, height);
        }
    }

    private drawVirtualMobile(p: p5): void {
        p.push();
        p.box(150, 300, 20);
        p.pop();
    }

    private getVertexShader(): string {
        return `
    precision highp float;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform float uRotationX;
    uniform float uRotationY;
    uniform float uRotationZ;
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    varying vec3 vNormal;
    varying vec3 vPosition;
    mat3 rotationX(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat3(
        1.0, 0.0, 0.0,
        0.0, c, -s,
        0.0, s, c
      );
    }
    mat3 rotationY(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat3(
        c, 0.0, s,
        0.0, 1.0, 0.0,
        -s, 0.0, c
      );
    }
    mat3 rotationZ(float angle) {
      float s = sin(angle);
      float c = cos(angle);
      return mat3(
        c, -s, 0.0,
        s, c, 0.0,
        0.0, 0.0, 1.0
      );
    }
    void main() {
      mat3 rotation = rotationZ(uRotationZ) * rotationY(uRotationY) * rotationX(uRotationX);
      vec3 rotatedPosition = rotation * aPosition;
      vec3 rotatedNormal = rotation * aNormal;
      vec4 worldPosition = uModelViewMatrix * vec4(rotatedPosition, 1.0);
      gl_Position = uProjectionMatrix * worldPosition;
      vPosition = worldPosition.xyz;
      vNormal = normalize(mat3(uModelViewMatrix) * rotatedNormal);
    }
    `;
    }

    private getFragmentShader(): string {
        return `
    precision highp float;
    uniform vec3 uLightPosition;
    uniform float uTime;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 lightDirection = normalize(uLightPosition - vPosition);
      float diffuse = max(dot(normal, lightDirection), 0.0);
      float lighting = 0.25 + diffuse * 0.75;
      vec3 baseColor = vec3(0.035, 0.045, 0.065);
      vec3 lightColor = vec3(0.25, 0.55, 1.0);
      vec3 finalColor = baseColor * lighting;
      finalColor += lightColor * diffuse * 0.15;
      gl_FragColor = vec4(finalColor, 1.0);
    }
    `;
    }
}