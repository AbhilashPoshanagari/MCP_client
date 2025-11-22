// table.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { ButtonLayout, FeatureDetail, Layout, MapLayout, TableLayout, WMSLayer } from '../components/models/message.model';

@Pipe({
  name: 'filterTables',
  pure: true,
  standalone: true
})
export class FilterTablesPipe implements PipeTransform {
  transform(layouts: Layout[] | undefined | null): TableLayout[] {
    console.log('FilterTablesPipe called');
    return layouts ? layouts.filter((layout): layout is TableLayout => layout.type === 'table') : [];
  }
}

// button.pipe.ts
@Pipe({
  name: 'filterButtons',
  pure: true,
  standalone: true
})
export class FilterButtonsPipe implements PipeTransform {
  transform(layouts: Layout[]| undefined | null): ButtonLayout[] {
    console.log('FilterButtonsPipe called');
    return layouts ? layouts.filter((layout): layout is ButtonLayout => layout.type === 'button') : [];
  }
}

// validation.pipe.ts
@Pipe({
  name: 'hasValidTableStructure',
  pure: true,
  standalone: true
})
export class HasValidTableStructurePipe implements PipeTransform {
  transform(table: TableLayout): boolean {
    console.log('HasValidTableStructurePipe called');
    return table?.data && 
           Array.isArray(table.data.column_names) && 
           table.data.column_names.length > 0 &&
           Array.isArray(table.data.data) &&
           table.data.data.every((row: any) => Array.isArray(row));
  }
}

@Pipe({ name: 'hasValidButtonStructure', pure: true, standalone: true })
export class HasValidButtonStructurePipe implements PipeTransform {
  transform(button: ButtonLayout): boolean {
    return !!button?.data?.link && 
           !!button.data.title &&
           this.isValidUrl(button.data.link);
  }
  
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return url.startsWith('/') || url.startsWith('#') || url.startsWith('?');
    }
  }
}

@Pipe({ name: 'getButtonLink', pure: true, standalone: true })
export class GetButtonLinkPipe implements PipeTransform {
  transform(button: ButtonLayout): string {
    return button.data.link || '#';
  }
}

@Pipe({ name: 'getButtonTitle', pure: true, standalone: true })
export class GetButtonTitlePipe implements PipeTransform {
  transform(button: ButtonLayout): string {
    return button.data.title || 'Click Here';
  }
}

@Pipe({ name: 'isExternalLink', pure: true, standalone: true })
export class IsExternalLinkPipe implements PipeTransform {
  transform(button: ButtonLayout): boolean {
    const link = button.data.link || '#';
    return link.startsWith('http://') || link.startsWith('https://');
  }
}

@Pipe({ name: 'filterMaps', pure: true, standalone: true })
export class FilterMapsPipe implements PipeTransform {
  transform(layouts: Layout[] | undefined | null): MapLayout[] {
    return layouts?.filter((layout): layout is MapLayout => layout.type === 'map') || [];
  }
}

@Pipe({ name: 'getMapFeatures', pure: true, standalone: true })
export class GetMapFeaturesPipe implements PipeTransform {
  transform(mapLayout: MapLayout | undefined | null): FeatureDetail[] {
    return mapLayout?.data?.features || [];
  }
}

@Pipe({ name: 'getMapWmsLayers', pure: true, standalone: true })
export class GetMapWmsLayersPipe implements PipeTransform {
  transform(mapLayout: MapLayout | undefined | null): WMSLayer[] {
    return mapLayout?.data?.wmsLayers || [];
  }
}

@Pipe({ name: 'getMapCenter', pure: true, standalone: true })
export class GetMapCenterPipe implements PipeTransform {
  transform(mapLayout: MapLayout | undefined | null): [number, number] {
    return mapLayout?.data?.center || [0, 0];
  }
}

@Pipe({ name: 'getMapZoom', pure: true, standalone: true })
export class GetMapZoomPipe implements PipeTransform {
  transform(mapLayout: MapLayout): number {
    return mapLayout?.data?.zoom || 10;
  }
}

@Pipe({ name: 'getMapHeight', pure: true, standalone: true })
export class GetMapHeightPipe implements PipeTransform {
  transform(mapLayout: MapLayout): string {
    return mapLayout?.data?.height || '400px';
  }
}

@Pipe({ name: 'getMapTitle', pure: true, standalone: true })
export class GetMapTitlePipe implements PipeTransform {
  transform(mapLayout: MapLayout): string | null {
    return mapLayout?.data?.title || null;
  }
}

@Pipe({ name: 'hasMapTitle', pure: true, standalone: true })
export class HasMapTitlePipe implements PipeTransform {
  transform(mapLayout: MapLayout): boolean {
    return !!mapLayout?.data?.title;
  }
}

@Pipe({ name: 'isValidMapLayout', pure: true, standalone: true })
export class IsValidMapLayoutPipe implements PipeTransform {
  transform(mapLayout: MapLayout): boolean {
    return !!mapLayout && 
           mapLayout.type === 'map' && 
           !!mapLayout.data;
  }
}
