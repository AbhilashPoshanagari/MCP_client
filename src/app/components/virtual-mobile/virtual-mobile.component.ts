import { AfterViewInit, Component, ElementRef, OnDestroy,ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { MotionService } from '../../services/digitalTwin/motion.service';
import { P5WebGLService } from '../../services/digitalTwin/p5-webgl.service';

@Component({
  selector: 'app-virtual-mobile',
  templateUrl:
    './virtual-mobile.component.html',
  styleUrls: [
    './virtual-mobile.component.scss'
  ]
})
export class VirtualMobileComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true })

  canvasContainer!: ElementRef<HTMLDivElement>;
  private rotationSubscription?: Subscription;
  private animationFrameId?:number;

  constructor( private p5WebGLService:P5WebGLService, private motionService:MotionService) { 

    }

  ngAfterViewInit(): void {
    const container = this.canvasContainer.nativeElement;
    this.p5WebGLService.createVirtualMobile(container);

    this.rotationSubscription = this.motionService.rotation$.subscribe(rotation => {
            this.p5WebGLService.updateRotation(rotation);
          });

    this.startMotionLoop();
  }

  private startMotionLoop(): void {
    const startTime = performance.now();
    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;

      /**
       * Temporary simulated motion.
       *
       * Remove this when real
       * accelerometer/gyroscope data
       * is connected.
       */
      this.motionService.simulateMotion(elapsed);
      this.motionService.update();
      this.animationFrameId = requestAnimationFrame(animate);
    };

    animate();
  }

  ngOnDestroy(): void {
    this.rotationSubscription?.unsubscribe();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.p5WebGLService.destroy();
  }
}