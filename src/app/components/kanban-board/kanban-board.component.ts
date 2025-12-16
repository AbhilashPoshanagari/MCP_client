import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

import { KanbanBoardData, KanbanCard, KanbanColumn } from '../models/message.model';
import { TruncatePipe } from '../../custom-pipes/kanban-board.pipe'; // Add this import
// import { ChatFormComponent } from '../chat-form/chat-form.component';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDrag, CdkDropList, TruncatePipe],
  templateUrl: './kanban-board.component.html',
  styleUrls: ['./kanban-board.component.css']
})
export class KanbanBoardComponent implements OnInit, OnChanges {
  @Input() data!: KanbanBoardData;
  @Output() actionTriggered = new EventEmitter<any>();
  @Output() boardUpdated = new EventEmitter<KanbanBoardData>();

    // Add these properties
  showForm = false;
  formLayout: any = null;
  formActionType: 'add' | 'edit' = 'add';
  targetColumnForNewCard: KanbanColumn | null = null;
  cardToEdit: KanbanCard | null = null;
  
  selectedCard: KanbanCard | null = null;
  selectedCardForMenu: KanbanCard | null = null;
  showCardMenu = false;
  menuPosition = { x: 0, y: 0 };
  showSettings = false;
  isAddingCardToColumn: string | null = null;
  
  settings = {
    allow_card_creation: false,
    allow_card_deletion: false,
    allow_card_editing: false,
    show_wip_limits: true,
    auto_save: true,
    show_avatars: true,
    compact_view: false
  };
  
  tagColors: Record<string, string> = {};
  
  get totalCards(): number {
    return this.data.columns.reduce((sum, column) => sum + column.cards.length, 0);
  }
  
  ngOnInit() {
    this.initializeSettings();
    this.generateTagColors();
    this.setupAutoSave();
  }
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['data']) {
      this.initializeSettings();
      this.generateTagColors();
    }
  }
  
  private initializeSettings() {
    if (this.data.settings) {
      this.settings = { ...this.settings, ...this.data.settings };
    }
  }
  
  private generateTagColors() {
    const allTags = new Set<string>();
    this.data.columns.forEach(column => {
      column.cards.forEach(card => {
        card.tags?.forEach(tag => allTags.add(tag));
      });
    });
    
    const colorPalette = [
      '#E3F2FD', '#F3E5F5', '#E8F5E8', '#FFF3E0',
      '#FCE4EC', '#F3E5F5', '#E8EAF6', '#E0F2F1',
      '#FFF8E1', '#F1F8E9', '#FFEBEE', '#ECEFF1'
    ];
    
    Array.from(allTags).forEach((tag, index) => {
      this.tagColors[tag] = colorPalette[index % colorPalette.length];
    });
  }
  
  private setupAutoSave() {
    if (this.settings.auto_save) {
      this.boardUpdated.subscribe(() => {
        this.autoSaveBoard();
      });
    }
  }
  
  // Drag & Drop Methods
  drop(event: CdkDragDrop<KanbanCard[]>) {
    // In your drop() method, add at the beginning:
    console.log('Previous container ID:', event.previousContainer.id);
    console.log('Current container ID:', event.container.id);
    console.log('Previous index:', event.previousIndex);
    console.log('Current index:', event.currentIndex);

    // In getConnectedLists():
    console.log('Connected lists:', this.data.columns.map(col => `cdk-drop-list-${col.id}`));
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      
          // Update the card's status based on target column
    const movedCard: any = event.container.data[event.currentIndex];
    const targetColumnId = event.container.id;
    
    // Find the target column to get its status
    const targetColumn = this.data.columns.find(col => 
      `cdk-drop-list-${col.id}` === targetColumnId || col.id === targetColumnId
    );
    
    if (targetColumn && movedCard) {
      movedCard.status = targetColumn.status;
      movedCard.updated_at = new Date().toISOString();
      
      // Log for debugging
      console.log(`Card moved to column: ${targetColumn.title}, status: ${targetColumn.status}`);
      
      // Emit action for server update
      this.actionTriggered.emit({
        type: 'move_card',
        action: this.data.actions?.move_card,
        card: movedCard,
        fromColumn: this.findColumnById(event.previousContainer.id),
        toColumn: targetColumn
      });
    }
  }
  
  this.emitBoardUpdate();
  }

  // Add this helper method to find column by container ID
findColumnById(containerId: string): KanbanColumn | undefined {
  const columnId = containerId.replace('cdk-drop-list-', '');
  return this.data.columns.find(col => col.id === columnId);
}
  
  getConnectedLists(): string[] {
    return this.data.columns.map(col => `cdk-drop-list-${col.id}`);;
  }
  
  getStatusFromColumnId(columnId: string): KanbanCard['status'] {
    const column = this.data.columns.find(col => col.id === columnId);
    return column?.status as KanbanCard['status'] || 'todo';
  }
  
  // Card Operations - Fixed with null checks
  openCardDetail(card: KanbanCard) {
    this.selectedCard = card;
  }
  
  closeCardDetail() {
    this.selectedCard = null;
  }
  
  openCardMenu(card: KanbanCard, event: MouseEvent) {
    event.preventDefault();
    this.selectedCardForMenu = card;
    this.showCardMenu = true;
    this.menuPosition = { x: event.clientX, y: event.clientY };
    
    setTimeout(() => {
      document.addEventListener('click', this.closeCardMenu.bind(this));
    });
  }
  
  closeCardMenu() {
    this.showCardMenu = false;
    this.selectedCardForMenu = null;
    document.removeEventListener('click', this.closeCardMenu.bind(this));
  }
  
  moveCardToColumn(card: KanbanCard | null, targetStatus: KanbanCard['status']) {
    if (!card) return;
    
    const sourceColumn = this.findCardColumn(card);
    const targetColumn = this.data.columns.find(col => col.status === targetStatus);
    
    if (sourceColumn && targetColumn && sourceColumn.id !== targetColumn.id) {
      sourceColumn.cards = sourceColumn.cards.filter(c => c.id !== card.id);
      card.status = targetStatus;
      card.updated_at = new Date().toISOString();
      targetColumn.cards.push(card);
      this.emitBoardUpdate();
    }
  }
  
  // Utility Methods
  findCardColumn(card: KanbanCard): KanbanColumn | undefined {
    return this.data.columns.find(column => 
      column.cards.some(c => c.id === card.id)
    );
  }
  
  getTagColor(tag: string): string {
    return this.tagColors[tag] || '#E0E0E0';
  }
  
  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }
  
  isOverdue(dueDate?: string): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }
  
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }
  
  formatDueDate(dueDate: string): string {
    const date = new Date(dueDate);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    return `In ${diffDays} days`;
  }
  
  getFileSize(attachment: any): string {
    return '1.2 MB';
  }
  
  copyCardLink(card: KanbanCard | null) {
    if (!card) return;
    
    const link = `${window.location.origin}/card/${card.id}`;
    navigator.clipboard.writeText(link).then(() => {
      console.log('Link copied to clipboard');
    });
  }
  
  exportCard(card: KanbanCard | null) {
    if (!card) return;
    
    const dataStr = JSON.stringify(card, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `card-${card.id}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }
  
  toggleSettings() {
    this.showSettings = !this.showSettings;
  }
  
  // Safe getters for template
  getSelectedCardAttachmentsLength(): number {
    return this.selectedCard?.attachments?.length || 0;
  }
  
  // Emit Updates
  private emitBoardUpdate() {
    this.boardUpdated.emit(this.data);
  }
  
  private autoSaveBoard() {
    console.log('Auto-saving board...', this.data);
  }

  // Add this helper method to get safe attachments length
  getCardAttachmentsLength(card: KanbanCard): number {
    return card.attachments?.length || 0;
  }
  
}