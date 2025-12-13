import { Component, Input, OnInit, OnChanges, SimpleChanges, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AgGridAngular } from 'ag-grid-angular';
import { 
  ColDef, 
  GridReadyEvent, 
  GridApi, 
  GridOptions,
  ClientSideRowModelModule,
  ModuleRegistry,
  Module,
  RowSelectionOptions, 
  themeQuartz,
  CellClassRules
} from 'ag-grid-community';
import { TableFormat } from '../models/message.model';

const sharedModules = [
  ClientSideRowModelModule
];
ModuleRegistry.registerModules(sharedModules);

@Component({
  selector: 'app-chat-data-table',
  standalone: true,
  imports: [CommonModule, AgGridAngular],
  templateUrl: './chat-data-table.component.html',
  styleUrls: ['./chat-data-table.component.css']
})
export class ChatDataTableComponent implements OnInit, OnChanges, AfterViewInit {
  modules: Module[] = [
    ClientSideRowModelModule,
  ];
  
  @Input() tableData!: TableFormat;
  @ViewChild(AgGridAngular) agGrid!: AgGridAngular;

  public rowData: any[] = [];
  public columnDefs: ColDef[] = [];
  public theme = themeQuartz;
  
  public rowSelection: RowSelectionOptions = { 
    mode: "multiRow", 
    enableClickSelection: true,
    checkboxes: true,
    headerCheckbox: true,
    selectAll: 'currentPage'
  };
  
  public defaultColDef: ColDef = {
    flex: 1,
    minWidth: 60,
    maxWidth: 500,
    resizable: true,
    sortable: true,
    filter: true,
    editable: false,
    wrapHeaderText: true,
    autoHeaderHeight: true,
    suppressMovable: true,
    cellStyle: { 
      borderRight: '1px solid #e2e8f0',
      borderBottom: '1px solid #f1f5f9',
      padding: '8px 12px',
      fontSize: '14px',
      lineHeight: '1.4'
    },
    cellClassRules: {
      'number-cell': (params) => typeof params.value === 'number',
      'boolean-cell': (params) => typeof params.value === 'boolean',
      'text-cell': (params) => typeof params.value === 'string',
      'null-cell': (params) => params.value === null || params.value === undefined
    } as CellClassRules,
    headerClass: 'ag-header-cell-custom',
    filterParams: {
      suppressAndOrCondition: true,
      buttons: ['apply', 'reset'],
      closeOnApply: true
    } as any,
    floatingFilter: true,
    floatingFilterComponentParams: {
      suppressFilterButton: true
    }
  };

  public gridOptions: GridOptions = {
    animateRows: true,
    enableCellTextSelection: true,
    suppressCellFocus: true,
    pagination: true,
    paginationPageSize: 10,
    paginationPageSizeSelector: [5, 10, 25, 50, 100],
    domLayout: 'normal',
    suppressHorizontalScroll: true,
    suppressColumnVirtualisation: false,
    rowHeight: 42,
    headerHeight: 48,
    overlayLoadingTemplate: '<div class="ag-overlay-loading-center"><span class="loading-spinner"></span><span>Loading data...</span></div>',
    overlayNoRowsTemplate: '<div class="ag-overlay-no-rows-center"><span class="no-data-icon">📊</span><span>No data to display</span></div>',
    enableRtl: false,
    enableBrowserTooltips: true,
    tooltipShowDelay: 500,
    tooltipMouseTrack: true,
    rowClass: 'ag-row-custom',
    suppressRowHoverHighlight: false,
    cellSelection: false,
    suppressDragLeaveHidesColumns: true,
    defaultColDef: this.defaultColDef
  };

  public gridApi!: GridApi;
  private resizeTimeout: any;

  ngOnInit() {
    this.processTableData();
  }

  ngAfterViewInit() {
    if (this.agGrid?.api) {
      this.gridApi = this.agGrid.api;
      this.setupGridTheme();
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    // Debounce resize events
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.sizeColumnsToFit();
    }, 250);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tableData'] && changes['tableData'].currentValue) {
      console.log('Table data changed:', this.tableData);
      this.processTableData();
      
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        if (this.gridApi) {
          this.gridApi.setGridOption('rowData', this.rowData);
          this.gridApi.setGridOption('columnDefs', this.columnDefs);
          this.gridApi.refreshCells({ force: true });
          this.gridApi.setGridOption('pagination', this.rowData.length > this.gridOptions.paginationPageSize!);
          this.sizeColumnsToFit();
        }
      });
    }
  }

  private processTableData(): void {
    console.log('Processing table data:', this.tableData);
    
    if (!this.tableData || !this.tableData.column_names || !this.tableData.data) {
      console.warn('No table data available');
      this.rowData = [];
      this.columnDefs = [];
      return;
    }

    console.log(`Processing ${this.tableData.column_names.length} columns and ${this.tableData.data.length} rows`);

    // Create column definitions with type-specific configurations
    this.columnDefs = this.tableData.column_names.map((columnName: string, index: number) => {
      const sampleData = this.tableData.data.map(row => row[index]);
      const isNumeric = sampleData.every(val => typeof val === 'number' || val === null || val === undefined);
      const isBoolean = sampleData.every(val => typeof val === 'boolean' || val === null || val === undefined);
      
      const colDef: ColDef = {
        headerName: this.formatHeader(columnName),
        field: `col${index}`,
        headerTooltip: columnName,
        cellRenderer: (params: any) => {
          const value = params.value;
          if (value === null || value === undefined) {
            return '<span class="null-value">—</span>';
          }
          if (typeof value === 'boolean') {
            return value ? 
              '<span class="boolean-true" title="True">✓</span>' : 
              '<span class="boolean-false" title="False">✗</span>';
          }
          if (typeof value === 'number') {
            const formatted = this.formatNumber(value);
            return `<span class="number-value" title="${value}">${formatted}</span>`;
          }
          const text = String(value);
          const truncated = text.length > 100 ? text.substring(0, 100) + '...' : text;
          return `<span class="text-value" title="${text}">${truncated}</span>`;
        },
        comparator: (valueA: any, valueB: any) => {
          if (valueA === null && valueB === null) return 0;
          if (valueA === null) return -1;
          if (valueB === null) return 1;
          
          if (typeof valueA === 'number' && typeof valueB === 'number') {
            return valueA - valueB;
          }
          if (typeof valueA === 'boolean' && typeof valueB === 'boolean') {
            return (valueA === valueB) ? 0 : valueA ? 1 : -1;
          }
          return String(valueA).localeCompare(String(valueB));
        },
        filter: isNumeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
        filterParams: isNumeric ? {
          filterOptions: ['equals', 'notEqual', 'lessThan', 'greaterThan', 'inRange'],
          maxNumConditions: 1
        } : {
          filterOptions: ['contains', 'notContains', 'equals', 'notEqual', 'startsWith', 'endsWith'],
          maxNumConditions: 1
        },
        cellStyle: (params) => {
          const styles: any = {};
          if (typeof params.value === 'number') {
            styles.textAlign = 'right';
            styles.fontFamily = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";
          } else if (typeof params.value === 'boolean') {
            styles.textAlign = 'center';
          }
          return styles;
        }
      };
      return colDef;
    });

    // Transform row data with alternating row styling
    this.rowData = this.tableData.data.map((row: Array<number | string | boolean>, rowIndex: number) => {
      const rowObject: any = { 
        id: rowIndex,
        _rowIndex: rowIndex // For styling purposes
      };
      row.forEach((cell: number | string | boolean, index: number) => {
        rowObject[`col${index}`] = cell;
      });
      return rowObject;
    });

    console.log('Processed columnDefs:', this.columnDefs);
    console.log('Processed rowData sample:', this.rowData.slice(0, 3));
  }

  private formatHeader(header: string): string {
    return header
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  private formatNumber(num: number): string {
    if (Number.isInteger(num)) {
      return num.toLocaleString();
    }
    // Format with appropriate decimal places
    const absNum = Math.abs(num);
    if (absNum === 0) return '0';
    if (absNum < 0.001) return num.toExponential(2);
    if (absNum < 1) return num.toFixed(4);
    if (absNum < 1000) return num.toFixed(2);
    if (absNum < 1000000) return (num / 1000).toFixed(2) + 'K';
    if (absNum < 1000000000) return (num / 1000000).toFixed(2) + 'M';
    return (num / 1000000000).toFixed(2) + 'B';
  }

  onGridReady(params: GridReadyEvent) {
    // console.log('Grid ready event fired');
    this.gridApi = params.api;
    
    // Set initial data
    this.gridApi.setGridOption('rowData', this.rowData);
    this.gridApi.setGridOption('columnDefs', this.columnDefs);
    
    // Configure grid
    this.gridApi.setGridOption('pagination', this.rowData.length > this.gridOptions.paginationPageSize!);
    
    // Auto-size columns after data is loaded
    setTimeout(() => {
      this.sizeColumnsToFit();
      this.setupGridTheme();
    }, 100);
  }

  private sizeColumnsToFit(): void {
    if (this.gridApi) {
      try {
        this.gridApi.sizeColumnsToFit({
          defaultMinWidth: 120,
          defaultMaxWidth: 400,
          columnLimits: [
            { key: 'id', minWidth: 60, maxWidth: 80 }
          ]
        });
        
        // Ensure all columns are visible
        const allColumnIds = this.gridApi.getColumns()?.map(column => column.getColId()) || [];
        this.gridApi.autoSizeColumns(allColumnIds, false);
      } catch (error) {
        console.warn('Error sizing columns:', error);
      }
    }
  }

  private setupGridTheme(): void {
    // Apply custom theme adjustments
    if (this.gridApi) {
      // const gridElement = this.gridApi.getGridCtrl().getGui();
      // gridElement.classList.add('custom-ag-theme');
        const gridElement = document.querySelector('ag-grid-angular');
        if (gridElement) {
          gridElement.classList.add('custom-ag-theme');
        }
    }
  }

  exportToCsv(): void {
    if (this.gridApi) {
      this.gridApi.exportDataAsCsv({
        fileName: `${this.tableData?.table_name || 'table_data'}_${new Date().toISOString().slice(0, 10)}`,
        processCellCallback: (params) => {
          return params.value !== null && params.value !== undefined ? 
            String(params.value) : '';
        },
        columnSeparator: ',',
        suppressQuotes: false,
        columnKeys: this.columnDefs.map((_, index) => `col${index}`)
      });
    }
  }

  exportToExcel(): void {
    if (this.gridApi) {
      this.gridApi.exportDataAsExcel({
        fileName: `${this.tableData?.table_name || 'table_data'}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: 'Data'
      });
    }
  }

  clearFilters(): void {
    if (this.gridApi) {
      this.gridApi.setFilterModel(null);
    }
  }

  clearSorting(): void {
    if (this.gridApi) {
      this.gridApi.applyColumnState({ defaultState: { sort: null } });
    }
  }

  togglePagination(): void {
    if (this.gridApi) {
      const currentPagination = this.gridApi.getGridOption('pagination');
      this.gridApi.setGridOption('pagination', !currentPagination);
    }
  }

  getGridApi(): GridApi | null {
    return this.gridApi || null;
  }

  getTotalRows(): number {
    return this.rowData.length;
  }

  getFilteredRows(): number {
    if (!this.gridApi) return this.rowData.length;
    return this.gridApi.getDisplayedRowCount();
  }
}