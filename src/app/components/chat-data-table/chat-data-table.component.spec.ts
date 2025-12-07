import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatDataTableComponent } from './chat-data-table.component';

describe('ChatDataTableComponent', () => {
  let component: ChatDataTableComponent;
  let fixture: ComponentFixture<ChatDataTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatDataTableComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatDataTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
