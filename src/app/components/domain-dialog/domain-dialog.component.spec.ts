import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DomainDialogComponent } from './domain-dialog.component';

describe('DomainDialogComponent', () => {
  let component: DomainDialogComponent;
  let fixture: ComponentFixture<DomainDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DomainDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DomainDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
