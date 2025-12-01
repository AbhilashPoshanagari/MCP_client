# AI Powered Chatbot with LangChain & MCP Integration

## Overview

A sophisticated chatbot application built with LangChain and OpenAI, featuring Model Context Protocol (MCP) integration and advanced UI capabilities for rich, interactive experiences.

## Features

### Core Architecture
- **LangChain & OpenAI**: Built on the LangChain framework with OpenAI's GPT models
- **Configurable API Keys**: Secure configuration management for OpenAI and MCP services
- **MCP Integration**: Support for Model Context Protocol servers over HTTP streamable connections

### MCP Capabilities
- **Tool Discovery**: Automatically detects available tools from connected MCP servers
- **Prompt Detection**: Identifies available prompts from MCP servers
- **Resource Detection**: Discovers accessible resources through MCP
- **Elicitation Forms**: Support for form-based data collection (URL-based elicitation not currently supported)
- **Sampling**: Ability to sample MCP server prompts (both assistant and user prompts)
- **Limitations**: Currently does not support prompt execution, resource calling, or chat completion via MCP

## Advanced UI Features

The chatbot supports rich, interactive layouts within conversations through a structured layout system.

### Layout System

Each message can contain multiple layouts of different types:

```typescript
export interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  layouts?: Layout[]; // Optional array of interactive layouts
}
```

### Available Layout Types

#### 1. **Table Layout**
Display structured tabular data with customizable columns and rows.

**Format:**
```typescript
{
  "type": "table",
  "data": {
    "table_name": string,
    "column_names": string[],
    "data": Array<Array<number | string | boolean>>
  }
}
```

**Example Usage:**
- Display query results
- Show comparative data
- Present structured information

#### 2. **Button Layout**
Add clickable action buttons with links or deep links.

**Format:**
```typescript
{
  "type": "button",
  "data": {
    "title": string,
    "link": string,
    "deeplink": string (optional)
  }
}
```

**Example Usage:**
- External navigation to maps, documents, or applications
- Quick action triggers
- Deep linking to mobile apps

#### 3. **Map Layout**
Visualize geospatial data using Leaflet maps with multiple layers and features.

**Format:**
```typescript
{
  "type": "map",
  "data": {
    "features": FeatureDetail[], // Optional
    "wmsLayers": WMSLayer[], // Optional
    "center": [number, number], // Optional
    "zoom": number, // Optional
    "title": string, // Optional
    "height": string // Optional
  }
}
```

**Supported Features:**
- Custom markers and feature.
- WMS (Web Map Service) layers
- Interactive feature properties
- Custom styling options

#### 4. **Form Layout**
Interactive forms for data collection with various input types and validation.

**Format:**
```typescript
{
  "type": "form",
  "data": {
    "title": string,
    "schema": any, // Form structure definition
    "metadata": { // Optional
      "formId": string,
      "createdBy": string,
      "version": string,
      "description": string,
      "totalFields": number
    },
    "actions": {
      "submit": FormAction,
      "cancel": FormAction
    }
  }
}
```

**Supported Form Widgets:**
- TextBox
- Dropdown with dynamic options
- Checkbox
- Radio buttons
- TextArea
- Number input

**Form Features:**
- Field validation and requirements
- Dynamic dropdowns
- Default values and placeholders
- Custom submit/cancel actions

## Data Format Validation

All layout data must adhere to the specified TypeScript interfaces. The frontend includes validation to ensure:
- Proper structure according to layout type
- Required fields are present
- Data types match expected formats
- Optional fields are correctly implemented

## Setup and Configuration

### Prerequisites
- Node.js (v22 or higher)
- OpenAI API key
- (Optional) MCP server URL for extended capabilities

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Set your OpenAI API key in the configuration
   - (Optional) Add MCP server URL for HTTP streamable connections

4. **Start the application**
   ```bash
   ng serve
   ```

### Configuration Options

**OpenAI Configuration:**
- API key is required for core chatbot functionality
- Configure through the settings interface or environment variables

**MCP Server Configuration:**
- Only HTTP streamable servers are supported
- URL must be provided by the user
- Tools, prompts, and resources are auto-detected upon connection

## Usage Examples

### Basic Chat
```javascript
// Simple text conversation
const message = {
  role: 'user',
  content: 'Hello, can you help me analyze this data?'
};
```

### Chat with Table Display
```javascript
// Message with table layout
const messageWithTable = {
  role: 'bot',
  content: 'Here are the downstream trace results:',
  layouts: [
    {
      type: 'table',
      data: {
        table_name: 'Analysis Results',
        column_names: ['ID', 'Name', 'Value'],
        data: [
          ['1', 'Result A', 42],
          ['2', 'Result B', 87]
        ]
      }
    }
  ]
};
```

### Interactive Form
```javascript
// Message with interactive form
const messageWithForm = {
  role: 'bot',
  content: 'Please fill out this form to proceed:',
  layouts: [
    {
      type: 'form',
      data: {
        title: 'User Information',
        schema: { /* Form schema */ },
        actions: {
          submit: {
            type: 'tool',
            title: 'Submit',
            description: 'Submit the form data',
            tool_name: 'process_form'
          },
          cancel: {
            type: 'cancel',
            title: 'Cancel',
            description: 'Cancel the operation'
          }
        }
      }
    }
  ]
};
```

## Limitations

### Current MCP Limitations
- ❌ Prompt execution/calling not supported
- ❌ Resource calling/execution not supported
- ❌ Chat completion via MCP not supported
- ❌ Non-HTTP MCP connections not supported

### Frontend Requirements
- Layout data must strictly follow the specified formats
- All interactive features require proper data structure validation
- Map features require Leaflet.js compatibility

## License

*Note: This chatbot requires proper OpenAI API key configuration to function. MCP features are optional but enhance capabilities when configured.*