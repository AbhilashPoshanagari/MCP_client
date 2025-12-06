import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatKanbanComponent } from './chat-kanban.component';

describe('ChatKanbanComponent', () => {
  let component: ChatKanbanComponent;
  let fixture: ComponentFixture<ChatKanbanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatKanbanComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatKanbanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
