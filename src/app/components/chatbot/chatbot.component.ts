import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { MapComponent } from '../map/map.component';
import { Component, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

import { Message, MapLayout, FeatureDetail, WMSLayer, Layout, 
  ButtonFormat, ButtonLayout, TableLayout } from '../models/message.model';
  // Import all the pipes
import { 
  // Table pipes
  FilterTablesPipe, 
  FilterButtonsPipe, 
  FilterMapsPipe,
  HasValidTableStructurePipe, 
  HasValidButtonStructurePipe,

  //Button pipes
  GetButtonLinkPipe, 
  GetButtonTitlePipe, 
  IsExternalLinkPipe,

  // Map pipes
  GetMapFeaturesPipe,
  GetMapWmsLayersPipe,
  GetMapCenterPipe,
  GetMapZoomPipe,
  GetMapHeightPipe,
  GetMapTitlePipe,
  HasMapTitlePipe,
  IsValidMapLayoutPipe
 } from '../../custom-pipes/chat-bot-pipes';

 import { FilterFormsPipe, 
  IsValidFormLayoutPipe } from '../../custom-pipes/form-layout.pipe';
import { ChatFormComponent } from '../chat-form/chat-form.component';
import { KanbanBoardComponent } from '../kanban-board/kanban-board.component';
import { ChatKanbanComponent } from '../chat-kanban/chat-kanban.component';
import { FilterKanbanPipe, IsKanbanLayoutPipe } from '../../custom-pipes/kanban-board.pipe';
import { ChatDataTableComponent } from '../chat-data-table/chat-data-table.component';

@Component({
  selector: 'app-chatbot',
  imports: [FormsModule, CommonModule, MarkdownModule, MapComponent,
    FilterTablesPipe, FilterButtonsPipe, FilterMapsPipe,
    HasValidTableStructurePipe, HasValidButtonStructurePipe,
    GetButtonLinkPipe, GetButtonTitlePipe, IsExternalLinkPipe,
    GetMapFeaturesPipe,
    GetMapWmsLayersPipe,
    GetMapCenterPipe,
    GetMapZoomPipe,
    GetMapHeightPipe,
    GetMapTitlePipe,
    HasMapTitlePipe,
    IsValidMapLayoutPipe,
    FilterFormsPipe, 
    IsValidFormLayoutPipe,
    ChatFormComponent,
    ChatDataTableComponent,
    ChatKanbanComponent,
    FilterKanbanPipe,
    IsKanbanLayoutPipe,
    MatIconModule
  ],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.css',
  standalone: true
})
export class ChatbotComponent{
  @ViewChild('chatMessages') private chatMessagesContainer!: ElementRef;
  @Input() messages: Message[] = [];
  // messages: Message[] = [];
  Math = Math
   // Active layout state
  private activeLayoutMessageId: string | null = null;
  private activeLayoutType: string | null = null;

  featureDetails: FeatureDetail[] = [];
  wmsLayers: WMSLayer[] = [];
  mapCenter: [number, number] = [0, 0];
  mapZoom: number = 2;
  shouldScrollToBottom = true;
  @Output() formSubmittedFromChat: EventEmitter<any> = new EventEmitter<any>()
  @Output() layoutSelected = new EventEmitter<any>();
    // New methods for layout management
  hasActiveLayout(): boolean {
    return this.activeLayoutMessageId !== null && this.activeLayoutType !== null;
  }

  getActiveLayoutType(): string | null {
    return this.activeLayoutType;
  }

  getActiveMessage(): Message | null {
    return this.messages.find(msg => msg.id === this.activeLayoutMessageId) || null;
  }

  getActiveTables(): TableLayout[] {
    const message = this.getActiveMessage();
    return message?.layouts ? this.getTables(message.layouts) : [];
  }

  getActiveButtons(): ButtonLayout[] {
    const message = this.getActiveMessage();
    return message?.layouts ? this.getButtons(message.layouts) : [];
  }

  getActiveMaps(): MapLayout[] {
    const message = this.getActiveMessage();
    return message?.layouts ? message.layouts.filter((layout): layout is MapLayout => layout.type === 'map') : [];
  }

  setActiveLayout(messageId: string, layoutType: string): void {
    this.activeLayoutMessageId = messageId;
    this.activeLayoutType = layoutType;
  }

  clearActiveLayout(): void {
    this.activeLayoutMessageId = null;
    this.activeLayoutType = null;
  }

  // Method to check if a message has any layout
  messageHasLayout(message: Message): boolean {
    return !!(message.layouts && message.layouts.length > 0);
  }

  // Method to get the first layout type from a message
  getMessageLayoutType(message: Message): string | null {
    if (!message.layouts || message.layouts.length === 0) {
      return null;
    }
    return message.layouts[0].type;
  }

  // Method to handle message click for layout activation
  onMessageClick(message: Message): void {
    if (this.messageHasLayout(message)) {
      const layoutType = this.getMessageLayoutType(message);
      if (layoutType) {
        if (this.activeLayoutMessageId === message.id && this.activeLayoutType === layoutType) {
          // Clicking the same message again toggles the layout off
          this.clearActiveLayout();
        } else {
          // Set new active layout
          this.setActiveLayout(message.id, layoutType);
        }
      }
    }
  }

  // Modified existing methods to add click handlers
  isTableLayout(layouts: Layout[]): boolean {
    return layouts.some(layout => layout.type === 'table');
  }

  isButtonLayout(layouts: Layout[]): boolean {
    return layouts.some(layout => layout.type === 'button');
  }

  isMapLayout(layouts: Layout[]): boolean {
    return layouts.some(layout => layout.type === 'map');
  }

  getMapData(layouts: Layout[]): MapLayout | null {
    const mapLayout = layouts.find((layout): layout is MapLayout => layout.type === 'map');
    return mapLayout || null;
  }

  // Method to handle map feature clicks
  onFeatureClick(feature: FeatureDetail) {
    console.log('Feature clicked:', feature);
    // You can add additional logic here, like showing a detailed message
  }

  scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatMessagesContainer) {
        this.chatMessagesContainer.nativeElement.scrollTop = this.chatMessagesContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  onChatScroll(): void {
    const element = this.chatMessagesContainer?.nativeElement;
    if (!element) return;

    const tolerance = 20;

    const isBottom =
      Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) <= tolerance;

    this.shouldScrollToBottom = isBottom;
  }

  getTables(layouts: Layout[]): TableLayout[] {
    return layouts.filter((layout): layout is TableLayout => layout.type === 'table');
  }

    // Get table headers
  getTableHeaders(table: TableLayout): string[] {
        console.log(table);
    return table.data.column_names || [];
  }

  // Get table data
  getTableData(table: TableLayout): any[][] {
        console.log(table);
    return table.data.data || [];
  }

  getButtons(layouts: Layout[]): ButtonLayout[] {
    return layouts.filter((layout): layout is ButtonLayout => layout.type === 'button');
  }

  private isSingleButton(layout: ButtonLayout): boolean | string {
    console.log(layout);
    return layout && 
           layout.type === 'button' && 
           layout.data.link && 
           layout.data.title;
  }

  hasValidButtonStructure(button: ButtonLayout): boolean {
    console.log(button)
    return !!button && 
          !!button.data && 
          !!button.data.link && 
          typeof button.data.link === 'string' &&
          !!button.data.title && 
          typeof button.data.title === 'string' &&
          this.isValidUrl(button.data.link);
  }

  hasValidTableStructure(table: TableLayout): boolean {
    console.log(table);
    return table?.data && 
          Array.isArray(table.data.column_names) && 
          table.data.column_names.length > 0 &&
          Array.isArray(table.data.data) &&
          table.data.data.every((row: any) => Array.isArray(row));
  }

  hasValidTableName(table: TableLayout): boolean | string {
    console.log(table);
    return table?.data?.table_name && 
          typeof table.data.table_name === 'string' && 
          table.data.table_name.trim().length > 0;
  }

  getButtonTitle(button: ButtonLayout): string {
    console.log(button)
    return button.data.title || 'Click Here';
  }

  getButtonLink(button: ButtonLayout): string {
    console.log(button)
    return button.data.link || '#';
  }

  isExternalLink(button: ButtonLayout): boolean {
    console.log(button)
    const link = this.getButtonLink(button);
    return link.startsWith('http://') || link.startsWith('https://');
  }

 private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      // Check if it's a relative URL or fragment
      return url.startsWith('/') || url.startsWith('#') || url.startsWith('?');
    }
  }

  // hasMapLayout(message: any): boolean {
  //   return message.layouts && this.isMapLayout(message.layouts);
  // }

  // Add form layout detection
  hasFormLayout(message: any): boolean {
    return message.layouts && 
          Array.isArray(message.layouts) && 
          message.layouts.some((layout: any) => layout.type === 'form');
  }

  hasMapLayout(message: any): boolean {
    return message.layouts && 
          Array.isArray(message.layouts) && 
          message.layouts.some((layout: any) => layout.type === 'map');
  }

  getFormTool(formLayout: any): any {
    console.log("form layout schema : ", formLayout)
    return {
      name: 'form-layout',
      inputSchema: formLayout.data.schema,
      // Add other required properties based on your NamedItem interface
    };
  }

  // Handle form responses
  // onFormResponse(event: {response: string, layouts?: Array<any>}, originalMessage: any, formIndex: number): void {
  //   console.log('Form submitted:', event);
    
  //   // You can update the original message or create a new one
  //   // For example, you might want to show the form results
  //   if (event.response) {
  //     // Add the form response as a new message or update the existing one
  //     const responseMessage = {
  //       role: 'user',
  //       content: `Form submitted: ${event.response}`,
  //       timestamp: new Date(),
  //       layouts: event.layouts
  //     };
      
  //     // Add to messages or handle as needed
  //     // this.messages = [...this.messages, responseMessage];
  //   }
  // }

  // // Handle form requests (if needed)
  // onFormRequest(event: {request: string}): void {
  //   console.log('Form request:', event);
  //   // Handle any form-initiated requests
  // }

    // Update the form section in template methods
  onChatFormSubmitted(event: {toolName: string, params: any}, message: any): void {
    console.log('Chat form submitted:', event);
    
    // Notify app component that a form was submitted from chat
    this.formSubmittedFromChat.emit({
      toolName: event.toolName,
      params: event.params
    });
  }

  onChatFormCancelled(): void {
    console.log('Chat form cancelled');
    // Optional: Add cancellation message
  }

  // private generateId(): string {
  //   return Date.now().toString();
  // }

  onKanbanAction(event: any) {
    console.log('Kanban action from chat:', event);
    
    // Handle different kanban actions
    switch (event.action.type) {
      case 'add_card':
        this.handleAddCardAction(event);
        break;
      case 'edit_card':
        this.handleEditCardAction(event);
        break;
      case 'delete_card':
        this.handleDeleteCardAction(event);
        break;
      case 'move_card':
        this.handleMoveCardAction(event);
        break;
    }
  }
  
  onKanbanBoardUpdated(event: any) {
    console.log('Kanban board updated from chat:', event);
    
    // Send update to MCP server or backend
    this.sendToMCP({
      type: 'kanban_update',
      layout_id: event.layout.data?.board_id,
      data: event.data,
      timestamp: new Date().toISOString()
    });
  }
  
  private handleAddCardAction(event: any) {
    // If action has a form, open it
    if (event.action.action?.type === 'form') {
      this.openKanbanForm(event.action.action, event.action.column);
    } else {
      // Direct tool call
      this.sendToMCP({
        type: 'kanban_add_card',
        column_id: event.action.column?.id,
        layout_id: event.layout.data?.board_id
      });
    }
  }
  
  private handleEditCardAction(event: any) {
    // Open edit form with card data
    this.openKanbanForm(
      event.action.action || { type: 'form', title: 'Edit Card' },
      event.action.card
    );
  }
  
  private handleDeleteCardAction(event: any) {
    this.sendToMCP({
      type: 'kanban_delete_card',
      card_id: event.action.card.id,
      layout_id: event.layout.data?.board_id
    });
  }
  
  private handleMoveCardAction(event: any) {
    this.sendToMCP({
      type: 'kanban_move_card',
      card_id: event.action.card.id,
      from_column: event.action.fromColumn?.id,
      to_column: event.action.toColumn?.id,
      layout_id: event.layout.data?.board_id
    });
  }
  
  private openKanbanForm(formAction: any, context: any) {
    // Create a form layout dynamically
    const formLayout: Layout = {
      type: 'form',
      data: {
        title: formAction.title || 'Kanban Form',
        schema: formAction.form_schema,
        metadata: {
          formId: `kanban-form-${Date.now()}`,
          context: context
        },
        actions: {
          submit: formAction.submit_action || {
            type: 'tool',
            tool_name: 'kanban_submit_form'
          },
          cancel: {
            type: 'cancel',
            title: 'Cancel'
          }
        }
      }
    };
    
    // Add form as a new message
    // this.addBotMessage('Please fill out this form:', [formLayout]);
    console.log('Please fill out this form:', [formLayout])
  }
  
  private sendToMCP(data: any) {
    // Your existing MCP communication logic
    console.log('Sending to MCP:', data);
    // this.mcpService.executeTool(data).subscribe(...);
  }

    selectLayout(layout: any): void {
    this.layoutSelected.emit(layout);
  }
}
