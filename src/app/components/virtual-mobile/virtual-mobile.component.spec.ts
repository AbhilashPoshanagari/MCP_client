import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VirtualMobileComponent } from './virtual-mobile.component';

describe('VirtualMobileComponent', () => {
  let component: VirtualMobileComponent;
  let fixture: ComponentFixture<VirtualMobileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VirtualMobileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VirtualMobileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
