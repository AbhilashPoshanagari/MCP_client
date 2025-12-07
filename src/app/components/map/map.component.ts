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
export class MapComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() height: string = '400px';
  @Input() featureDetails: FeatureDetail[] = [];
  @Input() geoJsonData: any = null; // New input for GeoJSON data
  @Input() wmsLayers: WMSLayer[] = [];
  @Input() center: [number, number] = [0, 0];
  @Input() zoom: number = 2;
  @Input() showPopup: boolean = true;
  @Input() useGeoJson: boolean = false; // Flag to use GeoJSON rendering
  
  @Output() featureClick = new EventEmitter<FeatureDetail>();
  
  private map!: L.Map;
  private featureLayer: L.LayerGroup = L.layerGroup();
  private geoJsonLayer: L.GeoJSON | null = null;
  private wmsLayersGroup: L.LayerGroup = L.layerGroup();
  public selectedFeature: FeatureDetail | null = null;
  public mapId: string = 'map-' + Math.random().toString(36).substr(2, 9);

  ngOnInit() {}

  ngAfterViewInit() {
    const mapElement = document.getElementById(this.mapId);
    if (mapElement) {
      mapElement.style.height = this.height;
      mapElement.style.width = '100%';
    }
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['featureDetails'] && this.map) {
      console.log("Features : ", changes['featureDetails']);
      this.updateFeatures();
    }
    if (changes['geoJsonData'] && this.map) {
      this.updateGeoJsonFeatures();
    }
    if (changes['wmsLayers'] && this.map) {
      this.updateWMSLayers();
    }
    if ((changes['center'] || changes['zoom']) && this.map) {
      this.map.setView(this.center, this.zoom);
    }
    if (changes['useGeoJson'] && this.map) {
      if (this.useGeoJson && this.geoJsonData) {
        this.updateGeoJsonFeatures();
      } else {
        this.updateFeatures();
      }
    }
  }

  private initializeMap() {
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

    // Initialize based on input
    if (this.useGeoJson && this.geoJsonData) {
      this.updateGeoJsonFeatures();
    } else {
      this.updateFeatures();
    }
    
    this.updateWMSLayers();
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

  private updateFeatures() {
    // Clear existing features
    this.featureLayer.clearLayers();
    if (this.geoJsonLayer) {
      this.map.removeLayer(this.geoJsonLayer);
      this.geoJsonLayer = null;
    }

    const markers: L.Layer[] = [];
    const bounds = L.latLngBounds([]);

    this.featureDetails.forEach(featureDetail => {
      const layer = this.createLayerFromFeature(featureDetail);
      if (layer) {
        // Store feature data in layer
        (layer as any).featureData = featureDetail;
        
        // Add popup if enabled
        if (this.showPopup) {
          const popupContent = this.createPopupContent(featureDetail);
          layer.bindPopup(popupContent, {
            closeButton: true,
            autoClose: false,
            closeOnEscapeKey: true
          });
        }

        // Add click event
        layer.on('click', () => {
          this.selectedFeature = featureDetail;
          this.featureClick.emit(featureDetail);
        });

        layer.addTo(this.featureLayer);
        markers.push(layer);

        // Update bounds
        this.updateBoundsFromLayer(layer, bounds);
      }
    });

    // Fit bounds if there are features
    if (markers.length > 0 && bounds.isValid()) {
      this.map.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 15
      });
    }
  }

  private updateGeoJsonFeatures() {
    // Clear existing features
    this.featureLayer.clearLayers();
    if (this.geoJsonLayer) {
      this.map.removeLayer(this.geoJsonLayer);
      this.geoJsonLayer = null;
    }

    if (!this.geoJsonData) return;

    // Create GeoJSON layer
    this.geoJsonLayer = L.geoJSON(this.geoJsonData, {
      pointToLayer: (feature, latlng) => {
        return this.createPointLayer(feature, latlng);
      },
      style: (feature) => {
        return this.getGeoJsonStyle(feature);
      },
      onEachFeature: (feature, layer) => {
        this.bindGeoJsonEvents(feature, layer);
      }
    }).addTo(this.map);

    // Fit bounds to GeoJSON features
    if (this.geoJsonLayer.getBounds().isValid()) {
      this.map.fitBounds(this.geoJsonLayer.getBounds(), {
        padding: [20, 20],
        maxZoom: 15
      });
    }
  }

  private createLayerFromFeature(feature: FeatureDetail): L.Layer | null {
    if (feature.geometry) {
      // If geometry is provided, use it
      return this.createLayerFromGeometry(feature.geometry, feature);
    } else if (feature.coordinates) {
      // For backward compatibility with point coordinates
      return L.circleMarker(
        [feature.coordinates[0], feature.coordinates[1]],
        {
          radius: feature.style?.radius || 8,
          color: feature.style?.color || '#ff0000',
          fillColor: feature.style?.fillColor || '#ff0000',
          fillOpacity: feature.style?.fillOpacity || 0.7,
          weight: 2,
          opacity: 1
        }
      );
    }
    return null;
  }

  private createLayerFromGeometry(geometry: any, feature: FeatureDetail): L.Layer | null {
    const type = geometry.type;
    const coordinates = geometry.coordinates;
    
    if (!coordinates) return null;

    const defaultStyle = {
      color: feature.style?.color || '#ff0000',
      fillColor: feature.style?.fillColor || '#ff0000',
      fillOpacity: feature.style?.fillOpacity || 0.7,
      weight: feature.style?.weight || 2,
      radius: feature.style?.radius || 8
    };

    switch (type) {
      case 'Point':
        // Note: GeoJSON uses [lng, lat], Leaflet uses [lat, lng]
        return L.circleMarker(
          [coordinates[1], coordinates[0]],
          {
            radius: defaultStyle.radius,
            color: defaultStyle.color,
            fillColor: defaultStyle.fillColor,
            fillOpacity: defaultStyle.fillOpacity,
            weight: defaultStyle.weight
          }
        );

      case 'LineString':
        const latLngs = coordinates.map((coord: [number, number]) => 
          L.latLng(coord[1], coord[0])
        );
        return L.polyline(latLngs, {
          color: defaultStyle.color,
          weight: defaultStyle.weight,
          opacity: 0.8
        });

      case 'Polygon':
        // Handle both simple polygons and multi-polygons
        const polygonLatLngs = this.parsePolygonCoordinates(coordinates);
        return L.polygon(polygonLatLngs, {
          color: defaultStyle.color,
          fillColor: defaultStyle.fillColor,
          fillOpacity: defaultStyle.fillOpacity,
          weight: defaultStyle.weight
        });

      case 'MultiLineString':
        const multiLineLatLngs = coordinates.map((line: any) =>
          line.map((coord: [number, number]) => L.latLng(coord[1], coord[0]))
        );
        return L.polyline(multiLineLatLngs, {
          color: defaultStyle.color,
          weight: defaultStyle.weight,
          opacity: 0.8
        });

      case 'MultiPolygon':
        const multiPolygonLatLngs = coordinates.map((polygon: any) =>
          this.parsePolygonCoordinates(polygon)
        );
        return L.polygon(multiPolygonLatLngs, {
          color: defaultStyle.color,
          fillColor: defaultStyle.fillColor,
          fillOpacity: defaultStyle.fillOpacity,
          weight: defaultStyle.weight
        });

      default:
        console.warn(`Unsupported geometry type: ${type}`);
        return null;
    }
  }

  private parsePolygonCoordinates(coordinates: any[]): L.LatLng[][] {
    return coordinates.map((ring: any) =>
      ring.map((coord: [number, number]) => L.latLng(coord[1], coord[0]))
    );
  }

  private createPointLayer(feature: any, latlng: L.LatLng): L.Layer {
    const properties = feature.properties || {};
    return L.circleMarker(latlng, {
      radius: 8,
      color: '#ff0000',
      fillColor: '#ff0000',
      fillOpacity: 0.7,
      weight: 2
    });
  }

  private getGeoJsonStyle(feature: any): L.PathOptions {
    const properties = feature.properties || {};
    
    // You can customize styles based on feature properties
    const type = feature.geometry?.type;
    
    const baseStyle: L.PathOptions = {
      color: '#ff0000',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.7
    };

    switch (type) {
      case 'Point':
        return {
          ...baseStyle,
          fillColor: '#ff0000'
        };
      case 'LineString':
        return {
          ...baseStyle,
          color: '#3388ff',
          fillColor: '#3388ff'
        };
      case 'Polygon':
        return {
          ...baseStyle,
          color: '#3388ff',
          fillColor: '#3388ff',
          fillOpacity: 0.3
        };
      default:
        return baseStyle;
    }
  }

  private bindGeoJsonEvents(feature: any, layer: L.Layer) {
    if (this.showPopup) {
      const popupContent = this.createGeoJsonPopupContent(feature);
      layer.bindPopup(popupContent, {
        closeButton: true,
        autoClose: false,
        closeOnEscapeKey: true
      });
    }

    layer.on('click', () => {
      const featureDetail: FeatureDetail = {
        id: feature.id || feature.properties?.id,
        name: feature.properties?.name,
        type: feature.geometry?.type,
        coordinates: feature.geometry?.coordinates?.[0] && feature.geometry?.coordinates?.[1] 
          ? [feature.geometry.coordinates[1], feature.geometry.coordinates[0]] 
          : null,
        properties: feature.properties || {},
        geometry: feature.geometry
      };
      this.selectedFeature = featureDetail;
      this.featureClick.emit(featureDetail);
    });
  }

  private updateBoundsFromLayer(layer: L.Layer, bounds: L.LatLngBounds) {
    if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
      bounds.extend(layer.getLatLng());
    } else if (layer instanceof L.Polyline || layer instanceof L.Polygon) {
      bounds.extend(layer.getBounds());
    }
  }

  private createPopupContent(feature: FeatureDetail): string {
    let coordinatesText = '';
    if (feature.coordinates) {
      coordinatesText = `${feature.coordinates[0].toFixed(4)}, ${feature.coordinates[1].toFixed(4)}`;
    } else if (feature.geometry?.coordinates) {
      const coords = feature.geometry.coordinates;
      if (feature.geometry.type === 'Point') {
        coordinatesText = `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}`;
      }
    }

    return `
      <div class="leaflet-popup-content">
        <div class="popup-header">
          <h4>${feature.name || 'Feature'}</h4>
        </div>
        <div class="popup-body">
          <p><strong>Type:</strong> ${feature.type}</p>
          ${coordinatesText ? `<p><strong>Coordinates:</strong> ${coordinatesText}</p>` : ''}
          ${this.createPropertiesContent(feature.properties)}
          ${feature.geometry ? `<p><strong>Geometry Type:</strong> ${feature.geometry.type}</p>` : ''}
        </div>
      </div>
    `;
  }

  private createGeoJsonPopupContent(feature: any): string {
    const properties = feature.properties || {};
    const geometry = feature.geometry || {};
    const name = properties.name || feature.id || 'Feature';
    const type = geometry.type || 'Unknown';
    
    let coordinatesText = '';
    if (geometry.coordinates) {
      if (geometry.type === 'Point') {
        coordinatesText = `${geometry.coordinates[1].toFixed(4)}, ${geometry.coordinates[0].toFixed(4)}`;
      }
    }

    return `
      <div class="leaflet-popup-content">
        <div class="popup-header">
          <h4>${name}</h4>
        </div>
        <div class="popup-body">
          <p><strong>Type:</strong> ${type}</p>
          ${coordinatesText ? `<p><strong>Coordinates:</strong> ${coordinatesText}</p>` : ''}
          ${this.createPropertiesContent(properties)}
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

  // Public method to add GeoJSON data
  addGeoJson(geoJson: any) {
    this.geoJsonData = geoJson;
    this.useGeoJson = true;
    if (this.map) {
      this.updateGeoJsonFeatures();
    }
  }

  // Public method to fit bounds to features
  fitToFeatures() {
    if (this.useGeoJson && this.geoJsonLayer) {
      this.map.fitBounds(this.geoJsonLayer.getBounds(), {
        padding: [20, 20],
        maxZoom: 15
      });
    } else if (this.featureDetails.length > 0) {
      const bounds = L.latLngBounds([]);
      this.featureDetails.forEach(feature => {
        if (feature.coordinates) {
          bounds.extend([feature.coordinates[0], feature.coordinates[1]]);
        }
      });
      
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, {
          padding: [20, 20],
          maxZoom: 15
        });
      }
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

  // Clear all features
  clearFeatures() {
    this.featureDetails = [];
    this.geoJsonData = null;
    this.useGeoJson = false;
    this.featureLayer.clearLayers();
    if (this.geoJsonLayer) {
      this.map.removeLayer(this.geoJsonLayer);
      this.geoJsonLayer = null;
    }
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