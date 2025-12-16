export interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  layouts?: Layout[];
}

// Use union type for layout types
export type LayoutType = 'table' | 'button' | 'map' | 'form' | 'kanban';
// export type Layout = TableLayout | ButtonLayout | MapLayout | FormLayout;
export interface Layout {
  type: LayoutType;
  data: any;
}

export interface MapLayout extends Layout {
  type: 'map';
  data: {
    features?: FeatureDetail[];
    wmsLayers?: WMSLayer[];
    center?: [number, number];
    zoom?: number;
    title?: string;
    height?: string;
  };
}

export interface TableFormat{
    table_name: string;
    column_names: Array<string>;
    data: Array<Array<number | string | boolean>>
}

export interface TableLayout extends Layout {
  type: 'table';
  data: TableFormat; // Your existing table structure
}

export interface ButtonFormat{
    title: string;
    link: string;
    deeplink?: string;
}

export interface ButtonLayout extends Layout {
  type: 'button';
  data: ButtonFormat; // Your existing button structure
}

export interface FeatureDetail {
  id?: string;
  name?: string;
  type: string;
  coordinates?: [number, number] | null;
  properties: { [key: string]: any };
  style?: {
    color?: string;
    radius?: number;
    fillColor?: string;
    fillOpacity?: number;
    weight?: number;
  };
  geometry?: {
    type: 'Point' | 'LineString' | 'Polygon' | 'MultiLineString' | 'MultiPolygon';
    coordinates: any; // Could be [number, number], [number, number][], etc.
  };
  // For trace results
  traceResult?: {
    type: string;
    features?: any[];
    properties?: { [key: string]: any };
  };
}

export interface WMSLayer {
  url: string;
  layers: string;
  version?: string;
  format?: string;
  transparent?: boolean;
  attribution?: string;
  opacity?: number;
}


// Add to your existing models in message.model.ts

// -------------------
// ENUMS
// -------------------
// export enum WidgetType {
//   TEXTBOX = "textBox",
//   STATUS = "status",
//   DROPDOWN = "dropdown",
//   CHECKBOX = "checkbox",
//   RADIO = "radio",
//   TEXTAREA = "textarea",
//   NUMBER = "number",
//   DATE = "date",
//   EMAIL = "email"
// }

// -------------------
// OPTION MODEL
// -------------------
export interface Option {
  displayValue: string;
  value: string;
  dependFields?: any;
}

// -------------------
// FORM WIDGET
// -------------------
export interface FormWidget {
  _id: string;
  id: string;
  label: string;
  isRequired: boolean | string;
  placeholder: string;
  defaultValue: string;
  minLength?: string | number | null;
  maxLength?: string | number | null;
  type: WidgetType;
  isUnderHeading: string;
  isDependentField: boolean;
  disabled: string;
  displayName: string;
  typeChange: string;
  dynamicDropdownTable: string;
  columnName: string;
  formId: string;
  position: number;
  __v: number;
  options?: Option[];
  isReassign?: boolean;
}

// -------------------
// FORM INFO / DATA
// -------------------
export interface FormInfo {
  _id: string;
  form_id: string;
  form_name: string;
  createdBy?: string;
  description?: string;
  dependentFields?: any[];
  displayField?: any[];
  version?: string;
}

export interface FormData {
  formWidgets: FormWidget[];
  isCurrentVersion: boolean;
  formInfo: FormInfo;
  referenceList: any[];
  recordInformation: any[];
}

export interface FormResponse {
  data: FormData;
  status: number;
}

export interface FormAction {
  type: 'tool' | 'api';
  title: string,
  tool_name?: string;
  url?: string;
  method?: string;
  description: string;
  params?: { [key: string]: any };
}

export interface FormActions {
  submit: FormAction;
  cancel: FormAction;
}

export interface FormLayout extends Layout {
  type: 'form';
  data: {
    title: string;
    schema: any;
    form_info?: FormInfo;
    metadata?: {
      formId: string;
      createdBy: string;
      version: string;
      description: string;
      totalFields: number;
    };
    actions: FormActions;
  };
}

// models/form.models.ts
export enum WidgetType {
  TEXTBOX = "textBox",
  STATUS = "status",
  DROPDOWN = "dropdown",
  SELECT = "select",
  CHECKBOX = "checkbox",
  RADIO = "radio",
  TEXTAREA = "textArea",
  NUMBER = "number",
  DATE = "date",
  EMAIL = "email"
}

// Option model
export interface Option {
  displayValue: string;
  value: string;
  dependFields?: any;
}

// FormWidget model
export interface FormWidget {
  _id: string;
  id: string;
  label: string;
  isRequired: boolean | string;
  placeholder: string;
  defaultValue: string;
  minLength?: string | number | null;
  maxLength?: string | number | null;
  type: WidgetType;
  isUnderHeading: string;
  isDependentField: boolean;
  disabled: string;
  displayName: string;
  typeChange: string;
  dynamicDropdownTable: string;
  columnName: string;
  formId: string;
  position: number;
  __v: number;
  options?: Option[];
  isReassign?: boolean;
}

// FormData model
export interface FormData {
  formWidgets: FormWidget[];
  isCurrentVersion: boolean;
  formInfo: FormInfo;
  referenceList: any[];
  recordInformation: any[];
  actions?: {
    submit: { label: string; type: string };
    cancel: { label: string; type: string };
    delete?: { label: string; type: string; style?: string };
  };
}

// FormLayout model

export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  assigneeAvatar?: string;
  due_date?: string;
  tags?: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in_progress' | 'review' | 'done';
  attachments?: Array<{ name: string; url: string; type: string }>;
  comments?: number;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface KanbanColumn {
  id: string;
  title: string;
  status: string;
  cards: KanbanCard[];
  wip_limit?: number;
  color?: string;
  icon?: string;
}

export interface KanbanBoardData {
  board_title: string;
  board_id?: string;
  columns: KanbanColumn[];
  settings?: {
    allow_card_creation: boolean;
    allow_card_deletion: boolean;
    allow_card_editing: boolean;
    show_wip_limits: boolean;
    auto_save: boolean;
    show_avatars: boolean;
    compact_view: boolean;
  };
  actions?: {
    add_card?: KanbanAction;
    edit_card?: KanbanAction;
    delete_card?: KanbanAction;
    move_card?: KanbanAction;
    view_card?: KanbanAction;
    add_column?: KanbanAction;
  };
  metadata?: {
    created_by: string;
    created_at: string;
    updated_at: string;
    version: string;
    total_cards: number;
  };
}

export interface KanbanAction {
  type: 'tool' | 'link' | 'form' | 'api';
  title: string;
  description?: string;
  tool_name?: string;
  url?: string;
  method?: string;
  payload?: any;
}

// Kanban specific interfaces (add these to your existing model file)
export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  assigneeAvatar?: string;
  due_date?: string;
  tags?: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'todo' | 'in_progress' | 'review' | 'done';
  attachments?: Array<{ name: string; url: string; type: string }>;
  comments?: number;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface KanbanColumn {
  id: string;
  title: string;
  status: string;
  cards: KanbanCard[];
  wip_limit?: number;
  color?: string;
  icon?: string;
}

export interface KanbanBoardData {
  board_title: string;
  board_id?: string;
  columns: KanbanColumn[];
  settings?: {
    allow_card_creation: boolean;
    allow_card_deletion: boolean;
    allow_card_editing: boolean;
    show_wip_limits: boolean;
    auto_save: boolean;
    show_avatars: boolean;
    compact_view: boolean;
  };
  actions?: {
    add_card?: KanbanAction;
    edit_card?: KanbanAction;
    delete_card?: KanbanAction;
    move_card?: KanbanAction;
    view_card?: KanbanAction;
    add_column?: KanbanAction;
  };
  metadata?: {
    created_by: string;
    created_at: string;
    updated_at: string;
    version: string;
    total_cards: number;
  };
}

export interface KanbanAction {
  type: 'tool' | 'link' | 'form' | 'api';
  title: string;
  description?: string;
  tool_name?: string;
  url?: string;
  method?: string;
  payload?: any;
}
