import { Component, Input, Output, EventEmitter  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ChatFormComponent } from '../components/chat-form/chat-form.component';
import { ChatKanbanComponent } from '../components/chat-kanban/chat-kanban.component';
import { ChatDataTableComponent } from '../components/chat-data-table/chat-data-table.component';
import { MapComponent } from '../components/map/map.component';
import {
  // Map pipes
  GetMapFeaturesPipe,
  GetMapWmsLayersPipe,
  GetMapCenterPipe,
  GetMapZoomPipe,
  GetMapHeightPipe,
  GetMapTitlePipe,
  HasMapTitlePipe,
  IsValidMapLayoutPipe,
  HasValidTableStructurePipe
 } from '../custom-pipes/chat-bot-pipes';
@Component({
  selector: 'app-workspace',
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    ChatFormComponent,
    ChatDataTableComponent,
    ChatKanbanComponent,
    MapComponent,
    GetMapFeaturesPipe,
    GetMapWmsLayersPipe,
    GetMapCenterPipe,
    GetMapZoomPipe,
    GetMapHeightPipe,
    GetMapTitlePipe,
    HasMapTitlePipe,
    IsValidMapLayoutPipe,
    HasValidTableStructurePipe
],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.css',
})
export class WorkspaceComponent {
  @Input() layout: any;
  @Output() layoutClosed = new EventEmitter<void>();
  
  getLayoutType(): string {
    if (!this.layout) return '';
    
    // Determine layout type based on structure
    if (this.layout.type === 'map' || this.layout.wmsLayers) return 'map';
    if (this.layout.type === 'table') return 'table';
    if (this.layout.type === 'kanban' || this.layout.boards) return 'kanban';
    if (this.layout.type === 'form' || this.layout.fields) return 'form';
    
    return 'unknown';
  }
  
  getLayoutTitle(): string {
    if (!this.layout) return '';
    
    return this.layout.data.title || 
           this.layout.data.name || 
           this.layout.data.table_name || 
           'Workspace Layout';
  }
  
  closeLayout(): void {
    this.layoutClosed.emit();
  }
  
  onFeatureClick(event: any): void {
    console.log('Feature clicked in workspace:', event);
  }
  
  onKanbanAction(event: any): void {
    console.log('Kanban action in workspace:', event);
  }
  
  onKanbanBoardUpdated(event: any): void {
    console.log('Kanban board updated in workspace:', event);
  }
  
  onFormSubmitted(event: any): void {
    console.log('Form submitted in workspace:', event);
  }
  
  onFormCancelled(): void {
    console.log('Form cancelled in workspace');
  }

}
