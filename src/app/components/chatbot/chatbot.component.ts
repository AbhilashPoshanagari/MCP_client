import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { MapComponent } from '../map/map.component';
import { Component, ViewChild, ElementRef, Input } from '@angular/core';
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
    IsValidMapLayoutPipe
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

  // Method to load sample map data (for testing)
  loadSampleMapData() {
    const sampleFeatures: FeatureDetail[] = [
      {
        id: '1',
        name: 'Central Park',
        type: 'Park',
        coordinates: [-73.9688, 40.7851],
        properties: {
          area: '843 acres',
          established: '1857',
          visitors: '42 million annually'
        },
        style: {
          color: '#28a745',
          fillColor: '#28a745',
          radius: 10,
          fillOpacity: 0.6
        }
      },
      {
        id: '2',
        name: 'Times Square',
        type: 'Entertainment',
        coordinates: [-73.9855, 40.7580],
        properties: {
          famousFor: 'Broadway theaters, electronic billboards',
          annualVisitors: '50 million'
        },
        style: {
          color: '#dc3545',
          fillColor: '#dc3545',
          radius: 8,
          fillOpacity: 0.6
        }
      }
    ];

    const sampleWMSLayers: WMSLayer[] = [{
      url: 'https://ows.terrestris.de/osm/service',
      layers: 'OSM-WMS',
      transparent: true
    }];

    this.featureDetails = sampleFeatures;
    this.wmsLayers = sampleWMSLayers;
    this.mapCenter = [-73.935242, 40.730610];
    this.mapZoom = 11;
  }

  // Example method to send a map message
  sendMapMessage() {
    const mapMessage: Message = {
      id: Date.now().toString(),
      role: 'bot',
      content: 'Here is the location data you requested:',
      timestamp: new Date(),
      layouts: [{
        type: 'map',
        data: {
          features: this.featureDetails,
          wmsLayers: this.wmsLayers,
          center: this.mapCenter,
          zoom: this.mapZoom,
          title: 'Location Overview',
          height: '300px'
        }
      }]
    };

    this.messages.push(mapMessage);
    this.scrollToBottom();
  }

  // Example of receiving a map message from API
  receiveMapDataFromAPI() {
    // Simulate API response with map data
    const apiResponse = {
      content: 'I found these locations for you:',
      layouts: [
        {
          type: 'map' as const,
          data: {
            features: [
              {
                id: 'api-1',
                name: 'Eiffel Tower',
                type: 'Landmark',
                coordinates: [2.2945, 48.8584],
                properties: {
                  height: '324 meters',
                  built: '1889'
                },
                style: {
                  color: '#ff6b00',
                  fillColor: '#ff6b00',
                  radius: 12,
                  fillOpacity: 0.6
                }
              }
            ],
            center: [2.3522, 48.8566],
            zoom: 13,
            title: 'Paris Locations',
            height: '350px'
          }
        }
      ] as Layout[]
    };

    const message: Message = {
      id: Date.now().toString(),
      role: 'bot',
      content: apiResponse.content,
      timestamp: new Date(),
      layouts: apiResponse.layouts
    };

    this.messages.push(message);
    this.scrollToBottom();
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

  hasMapLayout(message: any): boolean {
    return message.layouts && this.isMapLayout(message.layouts);
  }

}
