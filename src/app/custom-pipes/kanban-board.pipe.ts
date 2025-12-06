import { Pipe, PipeTransform } from '@angular/core';
import { Layout } from '../components/models/message.model';

@Pipe({
  name: 'truncate',
  standalone: true
})
export class TruncatePipe implements PipeTransform {
  transform(value: string | undefined | null, limit: number = 100, trail: string = '...'): string {
    if (!value) return '';
    
    if (value.length <= limit) {
      return value;
    }
    
    return value.substring(0, limit) + trail;
  }
}

@Pipe({
  name: 'isKanbanLayout',
  standalone: true
})
export class IsKanbanLayoutPipe implements PipeTransform {
  transform(layout: Layout): boolean {
    return layout.type === 'kanban' && 
           layout.data !== undefined && 
           layout.data.board_title !== undefined &&
           Array.isArray(layout.data.columns);
  }
}

@Pipe({
  name: 'filterKanban',
  standalone: true
})
export class FilterKanbanPipe implements PipeTransform {
  transform(layouts: Layout[] | null | undefined): Layout[] {
    if (!layouts) return [];
    return layouts.filter(layout => layout.type === 'kanban');
  }
}