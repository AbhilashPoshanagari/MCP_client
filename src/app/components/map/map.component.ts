import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';

import * as L from 'leaflet';
import { CommonModule } from '@angular/common';
import { FeatureDetail, WMSLayer } from '../models/message.model';

@Component({
  selector: 'app-map',
  imports: [CommonModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css',
  standalone: true
})
export class MapComponent implements OnInit, OnChanges, AfterViewInit{
  @Input() height: string = '400px';
  @Input() featureDetails: FeatureDetail[] = [];
  @Input() wmsLayers: WMSLayer[] = [];
  @Input() center: [number, number] = [0, 0];
  @Input() zoom: number = 2;
  @Input() showPopup: boolean = true;
  
  @Output() featureClick = new EventEmitter<FeatureDetail>();
  
  private map!: L.Map;
  private featureLayer: L.LayerGroup = L.layerGroup();
  private wmsLayersGroup: L.LayerGroup = L.layerGroup();
  public selectedFeature: FeatureDetail | null = null;
  public mapId: string = 'map-' + Math.random().toString(36).substr(2, 9);

    ngOnInit() {
    // Map initialization happens in AfterViewInit
  }

  ngAfterViewInit() {
    // Update map container height
    const mapElement = document.getElementById(this.mapId);
    console.log("Map element : ", mapElement)
    if (mapElement) {
      mapElement.style.height = this.height;
      mapElement.style.width = '100%';
    }
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['featureDetails'] && this.map) {
      console.log(changes['featureDetails']);
      this.updateFeatures();
    }
    if (changes['wmsLayers'] && this.map) {
      this.updateWMSLayers();
    }
    if ((changes['center'] || changes['zoom']) && this.map) {
      // console.log("type : ", typeof this.center[0])
      this.map.setView(this.center, this.zoom);
    }
  }

  private initializeMap() {
    // Create map
    // console.log("center : ", this.center, " Map id : ", this.mapId, " zoom : ", this.zoom);
    this.map = L.map(this.mapId).setView(this.center, this.zoom);

    // Add base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Add feature layer group
    this.featureLayer.addTo(this.map);

    // Add WMS layers group
    this.wmsLayersGroup.addTo(this.map);

    this.updateFeatures();
    this.updateWMSLayers();
  }

  private updateFeatures() {
    // Clear existing features
    this.featureLayer.clearLayers();

    this.featureDetails.forEach(featureDetail => {
      console.log("Feature : ", featureDetail)
      if (!featureDetail.coordinates) return;
      const marker = L.circleMarker(
        [featureDetail.coordinates[0], featureDetail.coordinates[1]], // Leaflet uses [lat, lng]
        {
          radius: featureDetail.style?.radius || 8,
          color: featureDetail.style?.color || '#ff0000',
          fillColor: featureDetail.style?.fillColor || '#ff0000',
          fillOpacity: featureDetail.style?.fillOpacity || 0.7,
          weight: 2,
          opacity: 1
        }
      );

      // Create popup content
      const popupContent = this.createPopupContent(featureDetail);

      marker.bindPopup(popupContent, {
        closeButton: true,
        autoClose: false,
        closeOnEscapeKey: true
      });

      // Add click event
      marker.on('click', () => {
        this.selectedFeature = featureDetail;
        this.featureClick.emit(featureDetail);
      });

      marker.addTo(this.featureLayer);

      // Store feature data in marker
      (marker as any).featureData = featureDetail;
    });

    // Fit bounds to show all features if there are any
    if (this.featureDetails.length > 0) {
      const group = new L.FeatureGroup();
      this.featureDetails.forEach(feature => {
        if (!feature.coordinates) return;
        group.addLayer(L.marker([feature.coordinates[0], feature.coordinates[1]]));
      });
      
      this.map.fitBounds(group.getBounds(), {
        padding: [20, 20],
        maxZoom: 15
      });
    }
  }

  private updateWMSLayers() {
    // Clear existing WMS layers
    this.wmsLayersGroup.clearLayers();

    this.wmsLayers.forEach((wmsConfig, index) => {
      const wmsLayer = L.tileLayer.wms(wmsConfig.url, {
        layers: wmsConfig.layers,
        version: wmsConfig.version || '1.3.0',
        format: wmsConfig.format || 'image/png',
        transparent: wmsConfig.transparent !== undefined ? wmsConfig.transparent : true,
        attribution: wmsConfig.attribution,
        opacity: wmsConfig.opacity || 0.7
      });

      wmsLayer.addTo(this.wmsLayersGroup);
    });
  }

  private createPopupContent(feature: FeatureDetail): string {
    if (!feature.coordinates) return "";
    // if(typeof feature.coordinates[0] == "string" && typeof feature.coordinates[1] == "string"){
    //   feature.coordinates[0] = parseFloat(feature.coordinates[0]);
    //   feature.coordinates[1] = parseFloat(feature.coordinates[1]);
    // }
    return `
      <div class="leaflet-popup-content">
        <div class="popup-header">
          <h4>${feature.name}</h4>
        </div>
        <div class="popup-body">
          <p><strong>Type:</strong> ${feature.type}</p>
          <p><strong>Coordinates:</strong> 
            ${feature.coordinates[0].toFixed(4)}, 
            ${feature.coordinates[1].toFixed(4)}
          </p>
          ${this.createPropertiesContent(feature.properties)}
        </div>
      </div>
    `;
  }

  private createPropertiesContent(properties: { [key: string]: any }): string {
    if (!properties || Object.keys(properties).length === 0) {
      return '';
    }

    const propertiesHtml = Object.keys(properties)
      .map(key => `
        <div class="property-item">
          <strong>${key}:</strong> ${properties[key]}
        </div>
      `).join('');

    return `
      <div class="properties-section">
        <h5>Properties:</h5>
        ${propertiesHtml}
      </div>
    `;
  }

  // Public method to fit bounds to features
  fitToFeatures() {
    if (this.featureDetails.length > 0) {
      const group = new L.FeatureGroup();
      this.featureDetails.forEach(feature => {
        if (!feature.coordinates) return;
        group.addLayer(L.marker([feature.coordinates[0], feature.coordinates[1]]));
      });
      
      this.map.fitBounds(group.getBounds(), {
        padding: [20, 20],
        maxZoom: 15
      });
    }
  }

  // Public method to add a single feature
  addFeature(feature: FeatureDetail) {
    this.featureDetails = [...this.featureDetails, feature];
    this.updateFeatures();
  }

  // Public method to remove a feature by id
  removeFeature(featureId: string) {
    this.featureDetails = this.featureDetails.filter(f => f.id !== featureId);
    this.updateFeatures();
  }

  getObjectKeys(obj: any): string[] {
    return obj ? Object.keys(obj) : [];
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

}
