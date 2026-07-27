export interface DeviceMotion {

  accelerationX: number;
  accelerationY: number;
  accelerationZ: number;

  rotationAlpha: number;
  rotationBeta: number;
  rotationGamma: number;
}

export interface VirtualMobileRotation {

  x: number;
  y: number;
  z: number;
}

// Explicit motion source, so the animation loop and the service agree on
// who is allowed to write to targetRotation at any given time.
export type MotionMode = 'simulated' | 'real';