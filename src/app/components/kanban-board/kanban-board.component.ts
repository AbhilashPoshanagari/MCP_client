

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { KanbanBoardData, KanbanCard, KanbanColumn, KanbanAction } from '../models/message.model';
import { TruncatePipe } from '../../custom-pipes/kanban-board.pipe'; // Add this import

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, TruncatePipe],
  templateUrl: './kanban-board.component.html',
  styleUrls: ['./kanban-board.component.css']
})
export class KanbanBoardComponent implements OnInit, OnChanges {
  @Input() data!: KanbanBoardData;
  @Output() actionTriggered = new EventEmitter<any>();
  @Output() boardUpdated = new EventEmitter<KanbanBoardData>();
  
  selectedCard: KanbanCard | null = null;
  selectedCardForMenu: KanbanCard | null = null;
  showCardMenu = false;
  menuPosition = { x: 0, y: 0 };
  showSettings = false;
  isAddingCardToColumn: string | null = null;
  
  settings = {
    allow_card_creation: true,
    allow_card_deletion: true,
    allow_card_editing: true,
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
  drop(event: CdkDragDrop<KanbanCard[]>, targetColumnId: string) {
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
      
      const movedCard = event.container.data[event.currentIndex];
      movedCard.status = this.getStatusFromColumnId(targetColumnId);
      movedCard.updated_at = new Date().toISOString();
    }
    
    this.emitBoardUpdate();
  }
  
  getConnectedLists(): string[] {
    return this.data.columns.map(col => col.id);
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
  
  // Fixed methods with null checks
  editCard(card: KanbanCard | null) {
    if (!card || !this.settings.allow_card_editing) return;
    
    this.actionTriggered.emit({
      type: 'edit_card',
      action: this.data.actions?.edit_card,
      card: card,
      column: this.findCardColumn(card)
    });
  }
  
  deleteCard(card: KanbanCard | null) {
    if (!card || !this.settings.allow_card_deletion) return;
    
    if (confirm('Are you sure you want to delete this card?')) {
      const column = this.findCardColumn(card);
      if (column) {
        column.cards = column.cards.filter(c => c.id !== card.id);
        this.emitBoardUpdate();
      }
    }
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
  
  // Action Methods
  openAddCardDialog(column?: KanbanColumn) {
    this.actionTriggered.emit({
      type: 'add_card',
      action: this.data.actions?.add_card,
      column: column
    });
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