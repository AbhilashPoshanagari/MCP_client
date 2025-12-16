import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

import { KanbanBoardData, KanbanCard, KanbanColumn, KanbanAction, WidgetType } from '../models/message.model';
import { TruncatePipe } from '../../custom-pipes/kanban-board.pipe'; // Add this import
import { ChatFormComponent } from '../chat-form/chat-form.component';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, FormsModule, CdkDrag, CdkDropList, TruncatePipe, ChatFormComponent],
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
      // this.actionTriggered.emit({
      //   type: 'move_card',
      //   action: this.data.actions?.move_card,
      //   card: movedCard,
      //   fromColumn: this.findColumnById(event.previousContainer.id),
      //   toColumn: targetColumn
      // });
    }
  }
  
  this.emitBoardUpdate();
  }

  // Add this helper method to find column by container ID
findColumnById(containerId: string): KanbanColumn | undefined {
  // Remove the 'cdk-drop-list-' prefix if present
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
  
  // Fixed methods with null checks
  editCard(card: KanbanCard | null) {
    if (!card || !this.settings.allow_card_editing) return;
    this.cardToEdit = card;
    this.formActionType = 'edit';
    this.showForm = true;
    
    // Generate form layout for editing the card
    this.formLayout = this.generateEditCardForm(card);
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
    this.targetColumnForNewCard = column || null;
    this.formActionType = 'add';
    this.showForm = true;
    
    // Generate form layout for adding a card
    this.formLayout = this.generateAddCardForm(column);

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

  // Helper method to generate form widget
// private generateFormWidget(
//   fieldId: string,
//   label: string,
//   widgetType: WidgetType,
//   position: number,
//   formId: string,
//   options?: any,
//   defaultValue?: any,
//   isRequired: boolean = false,
//   minLength?: number,
//   maxLength?: number
// ): any {
//   const widget: any = {
//     _id: fieldId,
//     id: fieldId,
//     label: label,
//     isRequired: isRequired,
//     placeholder: '',
//     defaultValue: defaultValue || '',
//     type: widgetType,
//     isUnderHeading: '',
//     isDependentField: false,
//     disabled: null,
//     displayName: label,
//     typeChange: '',
//     dynamicDropdownTable: '',
//     columnName: '',
//     formId: formId,
//     position: position,
//     __v: 0
//   };

//   if (minLength !== undefined) {
//     widget.minLength = minLength;
//   }
  
//   if (maxLength !== undefined) {
//     widget.maxLength = maxLength;
//   }
  
//   if (options) {
//     widget.options = options;
//   }
  
//   return widget;
// }

    // Handle form submission from chat-form
  handleFormSubmitted(event: {toolName: string, params: any}) {
  // The params should contain form_data based on your action definition
      const formData = event.params?.form_data || event.params;
      console.log("form data : ", formData)
      if (this.formActionType === 'add') {
        this.addCardFromForm(formData);
      } else if (this.formActionType === 'edit' && this.cardToEdit) {
        this.updateCardFromForm(this.cardToEdit, formData);
      }
      
      this.closeForm();
  }
  
  // Handle form cancellation
  handleFormCancelled() {
    this.closeForm();
  }

  // Add this helper method
private parseFormTags(tags: any): string[] {
  if (!tags) return [];
  
  if (Array.isArray(tags)) {
    return tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0);
  }
  
  if (typeof tags === 'string') {
    // Handle comma-separated string
    return tags.split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }
  
  return [];
}
  
  // Add new card from form data
private addCardFromForm(formData: any) {
  // Map sanitized field names back to card properties
  const newCard: KanbanCard = {
    id: this.generateCardId(),
    title: formData.title || '', // field name from sanitizeFieldName
    description: formData.description || '',
    assignee: formData.assignee || '',
    due_date: formData.due_date || undefined,
    priority: formData.priority || 'medium',
    tags: this.parseFormTags(formData.tags),
    status: (this.targetColumnForNewCard?.status as "todo") || 'todo',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    attachments: [],
    comments: 0
  };
  
  // Add to column
  if (this.targetColumnForNewCard) {
    this.targetColumnForNewCard.cards.push(newCard);
  } else if (this.data.columns.length > 0) {
    this.data.columns[0].cards.push(newCard);
  }
  
  this.emitBoardUpdate();
}
  
  // Update existing card from form data
  // private updateCardFromForm(card: KanbanCard, formData: any) {
  //   // Update card properties
  //   card.title = formData.title;
  //   card.description = formData.description || '';
  //   card.assignee = formData.assignee || '';
  //   card.due_date = formData.due_date || undefined;
  //   card.priority = formData.priority || 'medium';
  //   card.tags = formData.tags || [];
  //   card.updated_at = new Date().toISOString();
    
  //   this.emitBoardUpdate();
  // }

private updateCardFromForm(card: KanbanCard, formData: Partial<KanbanCard>) {      
  // Update all properties from formData using Object.entries
  Object.entries(formData).forEach(([key, value]) => {
    const typedKey = key as keyof KanbanCard;
    
    // Skip undefined values and special handling for falsy values
    if (value !== undefined) {
      // Handle empty strings for certain fields
      if (key === 'due_date' && !value) {
        (card[typedKey] as KanbanCard )= undefined as any;
      } else {
        (card[typedKey] as KanbanCard )= value as any;
      }
    }
  });
  
  // Always update timestamp
  card.updated_at = new Date().toISOString();
  
  this.emitBoardUpdate();
}
  
  // Generate unique card ID
  private generateCardId(): string {
    return 'card-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
  
  // Close form
  closeForm() {
    this.showForm = false;
    this.formLayout = null;
    this.targetColumnForNewCard = null;
    this.cardToEdit = null;
  }

    // Handle kanban action from form
  handleKanbanAction(event: any) {
    // Handle any specific kanban actions from the form
    if (event.type === 'delete_card' && this.cardToEdit) {
      this.deleteCard(this.cardToEdit);
      this.closeForm();
    }
    console.log('Kanban action from form:', event);
  }
  
  // Handle kanban board update from form
  handleKanbanBoardUpdated(event: any) {
    // Handle board updates from form if needed
    console.log('Kanban board update from form:', event);
  }

    // Generate form for adding a card
private generateAddCardForm(column?: KanbanColumn): any {
  const formId = 'add-card-form-' + Date.now();
  const formTitle = `Add New Card ${column ? `to ${column.title}` : ''}`;
  
  // Convert form widgets to schema properties format
  const schema = this.generateSchemaFromWidgets(this.getAddCardWidgets(formId));
  
  return {
    type: 'form',
    data: {
      title: formTitle,
      schema: schema,
      metadata: {
        form_id: formId,
        createdBy: 'system',
        version: '1.0',
        description: 'Add a new card to the kanban board',
        totalFields: 6,
        form_name: 'Add Card Form',
        comment: ''
      },
      actions: {
        submit: {
          type: 'tool',
          title: 'Submit',
          tool_name: 'add_record',
          description: 'Submit Add Card form',
          params: {
            form_data: {
              type: 'json'
            },
            form_id: {
              type: 'metadata',
              field: 'form_id'
            },
            form_name: {
              type: 'metadata',
              field: 'form_name'
            }
          }
        },
        cancel: {
          type: 'cancel',
          title: 'Cancel',
          description: 'Cancel form submission'
        }
      }
    }
  };
}

private generateEditCardForm(card: KanbanCard): any {
  const formId = 'edit-card-form-' + card.id;
  const formTitle = `Edit Card: ${card.title}`;
  
  // Convert form widgets to schema properties format
  const schema = this.generateSchemaFromWidgets(this.getEditCardWidgets(card, formId));
  
  return {
    type: 'form',
    data: {
      title: formTitle,
      schema: schema,
      metadata: {
        form_id: formId,
        createdBy: 'system',
        version: '1.0',
        description: 'Edit card details',
        totalFields: 6,
        form_name: 'Edit Card Form',
        comment: ''
      },
      actions: {
        submit: {
          type: 'tool',
          title: 'Submit',
          tool_name: 'update_record',
          description: 'Update card details',
          params: {
            form_data: {
              type: 'json'
            },
            form_id: {
              type: 'metadata',
              field: 'form_id'
            },
            form_name: {
              type: 'metadata',
              field: 'form_name'
            },
            card_id: card.id
          }
        },
        cancel: {
          type: 'cancel',
          title: 'Cancel',
          description: 'Cancel form submission'
        },
        delete: {
          type: 'tool',
          title: 'Delete',
          tool_name: 'delete_record',
          description: 'Delete this card',
          params: {
            card_id: card.id
          },
          style: 'danger'
        }
      }
    }
  };
}

// Helper to generate form widgets
private getAddCardWidgets(formId: string): any[] {
  return [
    {
      _id: 'title',
      id: 'title',
      label: 'Card Title',
      isRequired: true,
      type: 'textBox',
      defaultValue: '',
      minLength: 1,
      maxLength: 100,
      formId: formId,
      position: 1,
      __v: 0
    },
    {
      _id: 'card-description',
      id: 'card-description',
      label: 'Description',
      isRequired: false,
      type: 'textArea',
      defaultValue: '',
      formId: formId,
      position: 2,
      __v: 0
    },
    {
      _id: 'card-assignee',
      id: 'card-assignee',
      label: 'Assignee',
      isRequired: false,
      type: 'textBox',
      defaultValue: '',
      formId: formId,
      position: 3,
      __v: 0
    },
    {
      _id: 'card-due-date',
      id: 'card-due-date',
      label: 'Due Date',
      isRequired: false,
      type: 'date',
      defaultValue: '',
      formId: formId,
      position: 4,
      __v: 0
    },
    {
      _id: 'card-priority',
      id: 'card-priority',
      label: 'Priority',
      isRequired: false,
      type: 'dropdown',
      defaultValue: 'medium',
      formId: formId,
      position: 5,
      __v: 0,
      options: [
        { displayValue: "Low", value: "low", dependFields: null },
        { displayValue: "Medium", value: "medium", dependFields: null },
        { displayValue: "High", value: "high", dependFields: null },
        { displayValue: "Critical", value: "critical", dependFields: null }
      ]
    },
    {
      _id: 'card-tags',
      id: 'card-tags',
      label: 'Tags',
      isRequired: false,
      type: 'select',
      defaultValue: [],
      formId: formId,
      position: 6,
      __v: 0,
      options: [
        { displayValue: "Maintenance", value: "maintenance", dependFields: null },
        { displayValue: "Transformer", value: "transformer", dependFields: null },
        { displayValue: "Inspection", value: "inspection", dependFields: null },
        { displayValue: "Urgent", value: "urgent", dependFields: null },
        { displayValue: "Backlog", value: "backlog", dependFields: null }
      ]
    }
  ];
}

private getEditCardWidgets(card: KanbanCard, formId: string): any[] {
  return [
    {
      _id: `edit-title-${card.id}`,
      id: `edit-title-${card.id}`,
      label: 'Card Title',
      isRequired: true,
      type: 'textBox',
      defaultValue: card.title || '',
      minLength: 1,
      maxLength: 100,
      formId: formId,
      position: 1,
      __v: 0
    },
    {
      _id: `edit-description-${card.id}`,
      id: `edit-description-${card.id}`,
      label: 'Description',
      isRequired: false,
      type: 'textArea',
      defaultValue: card.description || '',
      formId: formId,
      position: 2,
      __v: 0
    },
    {
      _id: `edit-assignee-${card.id}`,
      id: `edit-assignee-${card.id}`,
      label: 'Assignee',
      isRequired: false,
      type: 'textBox',
      defaultValue: card.assignee || '',
      formId: formId,
      position: 3,
      __v: 0
    },
    {
      _id: `edit-due-date-${card.id}`,
      id: `edit-due-date-${card.id}`,
      label: 'Due Date',
      isRequired: false,
      type: 'date',
      defaultValue: card.due_date || '',
      formId: formId,
      position: 4,
      __v: 0
    },
    {
      _id: `edit-priority-${card.id}`,
      id: `edit-priority-${card.id}`,
      label: 'Priority',
      isRequired: false,
      type: 'select',
      defaultValue: card.priority || 'medium',
      formId: formId,
      position: 5,
      __v: 0,
      options: [
        { displayValue: "Low", value: "low", dependFields: null },
        { displayValue: "Medium", value: "medium", dependFields: null },
        { displayValue: "High", value: "high", dependFields: null },
        { displayValue: "Critical", value: "critical", dependFields: null }
      ]
    },
    {
      _id: `edit-tags-${card.id}`,
      id: `edit-tags-${card.id}`,
      label: 'Tags',
      isRequired: false,
      type: 'select',
      defaultValue: card.tags || [],
      formId: formId,
      position: 6,
      __v: 0,
      options: [
        { displayValue: "Maintenance", value: "maintenance", dependFields: null },
        { displayValue: "Transformer", value: "transformer", dependFields: null },
        { displayValue: "Inspection", value: "inspection", dependFields: null },
        { displayValue: "Urgent", value: "urgent", dependFields: null },
        { displayValue: "Backlog", value: "backlog", dependFields: null }
      ]
    }
  ];
}

// Convert form widgets to schema format
private generateSchemaFromWidgets(widgets: any[]): any {
  const properties: any = {};
  const required: string[] = [];
  
  widgets.forEach(widget => {
    const fieldName = this.sanitizeFieldName(widget.label || widget.id);
    
    // Build field schema
    const fieldSchema: any = {
      type: this.getSchemaType(widget.type),
      title: widget.label,
      widgetType: widget.type,
      defaultValue: widget.defaultValue,
      minLength: widget.minLength,
      maxLength: widget.maxLength
    };
    
    // Add options for dropdown/select
    if (widget.options) {
      fieldSchema.options = widget.options.map((opt: any) => ({
        displayValue: opt.displayValue,
        value: opt.value
      }));
    }
    
    // Add required fields
    if (widget.isRequired) {
      required.push(fieldName);
    }
    
    properties[fieldName] = fieldSchema;
  });
  
  return {
    type: 'object',
    properties: properties,
    required: required.length > 0 ? required : undefined
  };
}

private getSchemaType(widgetType: string): string {
  switch(widgetType) {
    case 'textBox':
    case 'textArea':
    case 'dropdown':
    case 'select':
    case 'date':
      return 'string';
    case 'number':
      return 'number';
    case 'checkbox':
      return 'boolean';
    default:
      return 'string';
  }
}

private sanitizeFieldName(name: string): string {
  // Convert to camelCase or snake_case
  return name.toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}
  
}