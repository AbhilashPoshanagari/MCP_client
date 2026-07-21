// import { Service } from '@angular/core';

// @Service()
// export class MotionService {
  
// }

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { DeviceMotion, VirtualMobileRotation } from './device-motion.model';

@Injectable({
  providedIn: 'root'
})
export class MotionService {

  private rotationSubject =
    new BehaviorSubject<VirtualMobileRotation>({
      x: 0,
      y: 0,
      z: 0
    });

  rotation$ =
    this.rotationSubject.asObservable();

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

  constructor() {}

  /**
   * This method will later receive
   * accelerometer/gyroscope data.
   */
  updateDeviceMotion(
    motion: DeviceMotion
  ): void {

    this.targetRotation = {

      x: this.degreesToRadians(
        motion.rotationBeta
      ),

      y: this.degreesToRadians(
        motion.rotationGamma
      ),

      z: this.degreesToRadians(
        motion.rotationAlpha
      )
    };
  }

  /**
   * Smooth the movement.
   */
  update(): void {

    const smoothing = 0.08;

    this.currentRotation.x =
      this.lerp(
        this.currentRotation.x,
        this.targetRotation.x,
        smoothing
      );

    this.currentRotation.y =
      this.lerp(
        this.currentRotation.y,
        this.targetRotation.y,
        smoothing
      );

    this.currentRotation.z =
      this.lerp(
        this.currentRotation.z,
        this.targetRotation.z,
        smoothing
      );

    this.rotationSubject.next({
      ...this.currentRotation
    });
  }

  /**
   * Mock motion for development.
   *
   * Later this can be removed and replaced
   * with real device sensor values.
   */
  simulateMotion(
    time: number
  ): void {

    this.targetRotation = {

      x: Math.sin(time * 0.8) * 0.35,

      y: Math.cos(time * 0.6) * 0.45,

      z: Math.sin(time * 0.4) * 0.15
    };
  }

  getCurrentRotation(): VirtualMobileRotation {

    return {
      ...this.currentRotation
    };
  }

  private lerp(
    start: number,
    end: number,
    amount: number
  ): number {

    return start + (end - start) * amount;
  }

  private degreesToRadians(
    degrees: number
  ): number {

    return degrees * Math.PI / 180;
  }
}