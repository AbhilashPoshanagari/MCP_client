import { Component, Input, Output, EventEmitter } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Layout, KanbanBoardData, KanbanCard } from '../models/message.model';
import { KanbanBoardComponent } from '../kanban-board/kanban-board.component';
@Component({
  selector: 'app-chat-kanban',
  imports: [FormsModule, DragDropModule, KanbanBoardComponent],
  templateUrl: './chat-kanban.component.html',
  styleUrl: './chat-kanban.component.css',
})
export class ChatKanbanComponent {
  @Input() kanbanLayout!: Layout;
  @Output() actionTriggered = new EventEmitter<any>();
  @Output() boardUpdated = new EventEmitter<any>();
  
  kanbanData: KanbanBoardData | null = null;
  isLoading = false;
  
  ngOnInit() {
    this.parseKanbanData();
  }
  
  private parseKanbanData() {
    if (this.kanbanLayout && this.kanbanLayout.type === 'kanban') {
      this.kanbanData = this.kanbanLayout.data as KanbanBoardData;
    }
  }
  
  onKanbanAction(event: any) {
    console.log('Kanban action triggered:', event);
    this.actionTriggered.emit({
      type: 'kanban_action',
      layout: this.kanbanLayout,
      action: event
    });
  }
  
  onBoardUpdated(updatedBoard: KanbanBoardData) {
    console.log('Kanban board updated:', updatedBoard);
    this.isLoading = true;
    
    // Emit the update to parent component
    this.boardUpdated.emit({
      type: 'kanban_update',
      layout: this.kanbanLayout,
      data: updatedBoard
    });
    
    // Simulate API call completion
    setTimeout(() => {
      this.isLoading = false;
    }, 500);
  }
}
