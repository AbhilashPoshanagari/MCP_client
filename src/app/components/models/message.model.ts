export interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  layouts?: Layout[];
}

export const examples = [
    {
        "type": "table",
        "data": {
            "tables":
            {
                "table_name": "Downstream Trace Results from Nearest Medium Voltage Transformer",
                "column_names": [
                    "Network Source ID",
                    "Global ID",
                    "Object ID",
                    "Terminal ID",
                    "Asset Group Code",
                    "Asset Type Code",
                    "Position From",
                    "Position To"
                ],
                "data": [
                    [
                        "14",
                        "{E0BA32EC-63FF-4C82-A720-F55B9802791D}",
                        "930",
                        "8",
                        "38",
                        "789",
                        "-",
                        "-"
                    ],
                    [
                        "14",
                        "{E0BA32EC-63FF-4C82-A720-F55B9802791D}",
                        "930",
                        "7",
                        "38",
                        "789",
                        "-",
                        "-"
                    ],
                    [
                        "9",
                        "{B266D258-0915-4B1E-8A5C-F24802167C28}",
                        "5560",
                        "1",
                        "22",
                        "422",
                        "-",
                        "-"
                    ],
                    [
                        "9",
                        "{159C1834-D7B8-4F6E-B232-E7547F538E81}",
                        "4019",
                        "1",
                        "22",
                        "422",
                        "-",
                        "-"
                    ],
                    [
                        "12",
                        "{3A5FA1E0-27DC-42C1-9EC0-606F5137C0EB}",
                        "1898",
                        "1",
                        "6",
                        "126",
                        "-",
                        "-"
                    ],
                    [
                        "9",
                        "{18F2482A-D80D-43FD-AEC4-C9DB2DAFCD10}",
                        "4610",
                        "8",
                        "38",
                        "789",
                        "-",
                        "-"
                    ],
                    [
                        "9",
                        "{246252D3-07E5-4F5B-8FC9-BEC3A82A603F}",
                        "9825",
                        "1",
                        "16",
                        "302",
                        "-",
                        "-"
                    ],
                    [
                        "9",
                        "{C2BDB58B-C5DB-49E4-A208-FF15DB4E3917}",
                        "5561",
                        "1",
                        "22",
                        "422",
                        "-",
                        "-"
                    ],
                    [
                        "9",
                        "{F10B3C4F-8775-475E-9329-59FE162F30AE}",
                        "8653",
                        "1",
                        "22",
                        "422",
                        "-",
                        "-"
                    ],
                    [
                        "9",
                        "{9FD9CC02-807A-4389-A10D-6A7122C768F0}",
                        "10247",
                        "1",
                        "22",
                        "422",
                        "-",
                        "-"
                    ],
                    [
                        "9",
                        "{7B16F82E-C3E3-4C7F-8323-9074FD9A71A6}",
                        "878",
                        "1",
                        "22",
                        "422",
                        "-",
                        "-"
                    ],
                    [
                        "12",
                        "{70FDD699-B80A-4C04-AE37-AD3E4F03A73D}",
                        "1952",
                        "1",
                        "6",
                        "126",
                        "-",
                        "-"
                    ],
                    [
                        "9",
                        "{694263D4-2AB3-42F3-8733-3647555ED210}",
                        "8654",
                        "1",
                        "22",
                        "422",
                        "-",
                        "-"
                    ],
                    [
                        "9",
                        "{48C3FBF1-76B7-4D88-B1EC-AFD176CC2AE7}",
                        "877",
                        "1",
                        "22",
                        "422",
                        "-",
                        "-"
                    ],
                    [
                        "4",
                        "{29896730-CB27-49CE-9912-C32B9E3A207B}",
                        "1036",
                        "1",
                        "104",
                        "121",
                        "-",
                        "-"
                    ],
                    [
                        "4",
                        "{BA47A314-287A-40E2-8EB2-2A1BAE08D4BC}",
                        "4843",
                        "1",
                        "106",
                        "201",
                        "-",
                        "-"
                    ],
                    [
                        "4",
                        "{FA667D6B-8833-4CC3-8C91-5DCF39586699}",
                        "5417",
                        "1",
                        "121",
                        "324",
                        "-",
                        "-"
                    ],
                    [
                        "4",
                        "{B37AAC7B-0E9E-4FC3-8ED6-B26CD98FD35E}",
                        "5590",
                        "1",
                        "104",
                        "121",
                        "-",
                        "-"
                    ],
                    [
                        "11",
                        "{71EA11AF-73BD-49FA-A602-D29B6E8E698E}",
                        "373",
                        "1",
                        "19",
                        "333",
                        "-",
                        "-"
                    ],
                    [
                        "10",
                        "{66A0611A-4637-4F54-B2F4-1214B5F8743B}",
                        "4375",
                        "-",
                        "37",
                        "102",
                        "0",
                        "1"
                    ],
                    [
                        "10",
                        "{9D7CCBDA-305A-4018-B984-E8413A98D2E9}",
                        "6142",
                        "-",
                        "37",
                        "102",
                        "0",
                        "1"
                    ],
                    [
                        "10",
                        "{A8D1C753-92D3-4481-82B3-BC414225B903}",
                        "2799",
                        "-",
                        "37",
                        "102",
                        "0",
                        "1"
                    ],
                    [
                        "10",
                        "{238CE009-8B94-4C22-96DA-08C8020C9DC0}",
                        "11564",
                        "-",
                        "37",
                        "102",
                        "0",
                        "1"
                    ],
                    [
                        "10",
                        "{D7AB667E-DD63-4DF4-A7F2-1595C185FEFC}",
                        "7963",
                        "-",
                        "37",
                        "102",
                        "0",
                        "1"
                    ],
                    [
                        "10",
                        "{9C0A4247-E309-4E42-83FF-82C4A1CF9192}",
                        "11565",
                        "-",
                        "37",
                        "102",
                        "0",
                        "1"
                    ],
                    [
                        "10",
                        "{AF1553E4-D307-40B1-B9BE-E7A86D5EB804}",
                        "7873",
                        "-",
                        "37",
                        "102",
                        "0",
                        "1"
                    ],
                    [
                        "10",
                        "{0CDE4D26-561A-419B-9208-0B2DFEEAE42F}",
                        "13482",
                        "-",
                        "37",
                        "102",
                        "0",
                        "1"
                    ],
                    [
                        "10",
                        "{5703261C-AD4D-4D45-A0BF-49FCA9E4E0B9}",
                        "7872",
                        "-",
                        "37",
                        "102",
                        "0",
                        "1"
                    ],
                    [
                        "10",
                        "{6BC0A604-4776-422D-A5E9-D93DBE9022B2}",
                        "11563",
                        "-",
                        "37",
                        "102",
                        "0",
                        "1"
                    ],
                    [
                        "10",
                        "{B86B0A17-9FF2-4869-B4BA-6238EC6526A0}",
                        "6141",
                        "-",
                        "37",
                        "102",
                        "0",
                        "1"
                    ]
                ]
            }
    }
    },
    {
        "type": "button",
        "data":{ "title": "Location",
        "link": "https://www.google.com/maps/search/?api=1&query=17.4457222,78.3488216"
        }
    }
]

// Use union type for layout types
export type LayoutType = 'table' | 'button' | 'map' | 'form';
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
  };
  geometry?: {[key: string]: any};
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
export enum WidgetType {
  TEXTBOX = "textBox",
  STATUS = "status",
  DROPDOWN = "dropdown",
  CHECKBOX = "checkbox",
  RADIO = "radio",
  TEXTAREA = "textarea",
  NUMBER = "number",
  DATE = "date",
  EMAIL = "email"
}

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
  id: string;
  name: string;
  createdBy: string;
  description: string;
  dependentFields: any[];
  displayField: any[];
  version: string;
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

// -------------------
// FORM LAYOUT INTERFACE
// -------------------
// export interface FormLayout extends Layout {
//   type: 'form';
//   data: {
//     title?: string;
//     schema?: any; // JSON schema for simple forms
//     formData?: FormData; // Full form data from your backend
//     formSchema?: any; // Dynamic form schema generated from formData
//   };
// }

// Update the LayoutType union
// export type LayoutType = 'table' | 'button' | 'map' | 'form';

// Update the Layout union type to include FormLayout

// Update your message.model.ts
export interface FormAction {
  type: 'tool' | 'cancel' | 'custom';
  title: string,
  tool_name?: string;
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
