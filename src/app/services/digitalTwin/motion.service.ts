import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DeviceMotion, MotionMode, VirtualMobileRotation } from './device-motion.model';

@Injectable({
  providedIn: 'root'
})
export class MotionService {

  private rotationSubject = new BehaviorSubject<VirtualMobileRotation>({
    x: 0,
    y: 0,
    z: 0
  });

  rotation$ = this.rotationSubject.asObservable();

  // NEW: tracks which source is allowed to drive targetRotation right now.
  private modeSubject = new BehaviorSubject<MotionMode>('simulated');
  mode$ = this.modeSubject.asObservable();

  private targetRotation: VirtualMobileRotation = {
    x: 0,
    y: 0,
    z: 0
  };

  private currentRotation: VirtualMobileRotation = {
    x: 0,
    y: 0,
    z: 0
  };

  // Smoothing factor - lower = smoother but slower response
  private smoothingFactor: number = 0.15;

  constructor() {}

  setSmoothingFactor(factor: number): void {
    this.smoothingFactor = Math.max(0.01, Math.min(0.5, factor));
  }

  getMode(): MotionMode {
    return this.modeSubject.value;
  }

  // Explicitly switch source. Call this from the component when the user
  // toggles "real device motion" on/off, or when permission is granted/denied.
  setMode(mode: MotionMode): void {
    this.modeSubject.next(mode);
  }

  updateDeviceMotion(motion: DeviceMotion): void {
    // Guard: ignore stray device-motion events if we're not in 'real' mode
    // (e.g. a late event arriving after the user switched back to simulated).
    if (this.modeSubject.value !== 'real') {
      return;
    }
    this.targetRotation = {
      x: this.degreesToRadians(motion.rotationBeta),
      y: this.degreesToRadians(motion.rotationGamma),
      z: this.degreesToRadians(motion.rotationAlpha)
    };
  }

  update(): void {
    // Use smoother interpolation with easing
    this.currentRotation.x = this.smoothValue(this.currentRotation.x, this.targetRotation.x);
    this.currentRotation.y = this.smoothValue(this.currentRotation.y, this.targetRotation.y);
    this.currentRotation.z = this.smoothValue(this.currentRotation.z, this.targetRotation.z);

    this.rotationSubject.next({
      ...this.currentRotation
    });
  }

  private smoothValue(current: number, target: number): number {
    // Add a small epsilon to prevent floating point stuttering
    const diff = target - current;
    if (Math.abs(diff) < 0.0001) {
      return target;
    }
    return current + diff * this.smoothingFactor;
  }

  simulateMotion(time: number): void {
    // FIX: only drive the target rotation when we're actually in simulated
    // mode. Previously this ran unconditionally every frame and silently
    // overwrote any real device-motion data on the very next tick.
    if (this.modeSubject.value !== 'simulated') {
      return;
    }
    // More natural-looking motion with varied frequencies
    this.targetRotation = {
      x: Math.sin(time * 0.7 + 0.3) * 0.3 + Math.sin(time * 0.3) * 0.1,
      y: Math.cos(time * 0.5 + 0.7) * 0.4 + Math.sin(time * 0.4) * 0.1,
      z: Math.sin(time * 0.3 + 1.2) * 0.15 + Math.cos(time * 0.2) * 0.05
    };
  }

  getCurrentRotation(): VirtualMobileRotation {
    return {
      ...this.currentRotation
    };
  }

  private lerp(start: number, end: number, amount: number): number {
    return start + (end - start) * amount;
  }

  private degreesToRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  // Reset rotation to zero
  resetRotation(): void {
    this.targetRotation = { x: 0, y: 0, z: 0 };
    this.currentRotation = { x: 0, y: 0, z: 0 };
    this.rotationSubject.next({ x: 0, y: 0, z: 0 });
  }
}
