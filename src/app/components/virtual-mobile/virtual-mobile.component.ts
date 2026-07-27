import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MotionService } from '../../services/digitalTwin/motion.service';
import { P5WebGLService } from '../../services/digitalTwin/p5-webgl.service';
import { DeviceMotion } from '../../services/digitalTwin/device-motion.model';

@Component({
  selector: 'app-virtual-mobile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './virtual-mobile.component.html',
  styleUrls: ['./virtual-mobile.component.scss']
})
export class VirtualMobileComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true })
  canvasContainer!: ElementRef<HTMLDivElement>;

  private rotationSubscription?: Subscription;
  private animationFrameId?: number;
  private resizeObserver?: ResizeObserver;
  private isDestroyed: boolean = false;

  // Exposed to the template so the user can see/toggle which motion source
  // is currently driving the phone.
  usingRealMotion = false;
  motionError: string | null = null;
  renderError: string | null = null;

  private readonly handleDeviceOrientation = (event: DeviceOrientationEvent): void => {
    if (this.isDestroyed) return;
    const motion: DeviceMotion = {
      accelerationX: 0,
      accelerationY: 0,
      accelerationZ: 0,
      rotationAlpha: event.alpha ?? 0,
      rotationBeta: event.beta ?? 0,
      rotationGamma: event.gamma ?? 0,
    };
    this.motionService.updateDeviceMotion(motion);
  };

  constructor(
    private p5WebGLService: P5WebGLService,
    private motionService: MotionService
  ) {
    // Set a smoother interpolation factor
    this.motionService.setSmoothingFactor(0.08);
  }

  ngAfterViewInit(): void {
    const container = this.canvasContainer.nativeElement;

    try {
      this.p5WebGLService.createVirtualMobile(container);
    } catch (err) {
      // FIX: creation could previously throw silently (unsupported WebGL,
      // shader compile failure, etc.) with no feedback to the user.
      this.renderError = 'Your device/browser does not support the 3D preview.';
      console.error('VirtualMobileComponent: failed to initialize renderer', err);
      return;
    }

    // Subscribe to rotation updates
    this.rotationSubscription = this.motionService.rotation$.subscribe(rotation => {
      if (!this.isDestroyed) {
        this.p5WebGLService.updateRotation(rotation);
      }
    });

    this.startMotionLoop();
    this.observeResize(container);
  }

  // FIX: resize() on the p5 service existed but nothing ever called it, so
  // the canvas/perspective went stale whenever the container was resized
  // (e.g. modal opening animation, window resize, orientation change).
  private observeResize(container: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.p5WebGLService.resize(width, height);
      }
    });
    this.resizeObserver.observe(container);
  }

  private startMotionLoop(): void {
    let startTime = performance.now();

    const animate = () => {
      if (this.isDestroyed) {
        return;
      }

      const currentTime = performance.now();
      const elapsed = (currentTime - startTime) / 1000;

      // NOTE: simulateMotion() and updateDeviceMotion() are now both
      // mode-gated inside MotionService, so whichever source is NOT active
      // is a safe no-op instead of clobbering the other's data.
      this.motionService.simulateMotion(elapsed);

      // Update the smoothed rotation
      this.motionService.update();

      // Request next frame with proper timing
      this.animationFrameId = requestAnimationFrame(() => {
        if (!this.isDestroyed) {
          animate();
        }
      });
    };

    animate();
  }

  // Call from a user gesture (button click) — iOS 13+ requires
  // DeviceOrientationEvent.requestPermission() to be called directly from a
  // user interaction, so this can't be triggered automatically on load.
  async requestDeviceMotion(): Promise<void> {
    this.motionError = null;

    if (typeof DeviceOrientationEvent === 'undefined') {
      this.motionError = 'Device orientation is not supported on this device.';
      return;
    }

    const maybeRequestPermission = (DeviceOrientationEvent as any).requestPermission;
    if (typeof maybeRequestPermission === 'function') {
      try {
        const response = await maybeRequestPermission();
        if (response !== 'granted') {
          this.motionError = 'Motion permission was denied.';
          return;
        }
      } catch (err) {
        this.motionError = 'Could not request motion permission.';
        console.error('VirtualMobileComponent: permission request failed', err);
        return;
      }
    }

    window.addEventListener('deviceorientation', this.handleDeviceOrientation);
    this.motionService.setMode('real');
    this.usingRealMotion = true;
  }

  useSimulatedMotion(): void {
    window.removeEventListener('deviceorientation', this.handleDeviceOrientation);
    this.motionService.setMode('simulated');
    this.usingRealMotion = false;
    this.motionError = null;
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;

    window.removeEventListener('deviceorientation', this.handleDeviceOrientation);

    if (this.rotationSubscription) {
      this.rotationSubscription.unsubscribe();
      this.rotationSubscription = undefined;
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    // Always leave MotionService back in simulated mode so re-opening the
    // digital twin (or any other consumer) doesn't inherit a stale 'real'
    // mode with no listener attached to feed it.
    this.motionService.setMode('simulated');

    if (this.p5WebGLService) {
      this.p5WebGLService.destroy();
    }
  }
}
