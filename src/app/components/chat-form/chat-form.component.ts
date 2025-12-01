import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormLayout } from '../models/message.model';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chat-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat-form.component.html',
  styleUrl: './chat-form.component.css'
})
export class ChatFormComponent {
  @Input() formLayout!: FormLayout;
  @Output() formSubmitted = new EventEmitter<{toolName: string, params: any}>();
  @Output() formCancelled = new EventEmitter<void>();

  formFields: any[] = [];
  showMetadata = false;
  isSubmitting = false;
  isSubmitted = false; 
  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({});
  }

  ngOnChanges(): void {
    if (this.formLayout?.data?.schema) {
      this.buildForm();
      this.isSubmitted = false;
    }
  }

  private buildForm(): void {
    const schema = this.formLayout.data.schema;
    this.formFields = [];
    const formGroupConfig: any = {};

    if (schema?.properties) { // Check for properties instead of schema directly
      // Convert the properties object to array and sort by position
      this.formFields = Object.keys(schema.properties).map(key => {
        const fieldConfig = schema.properties[key];
        
        return {
          key: key,
          title: fieldConfig.title || key,
          type: this.determineFieldType(fieldConfig),
          widgetType: fieldConfig.widgetType,
          placeholder: fieldConfig.description || '',
          options: fieldConfig.options,
          required: this.isFieldRequired(key, schema.required),
          position: fieldConfig.position || 0
        };
      }).sort((a, b) => a.position - b.position);

      // Build form controls
      this.formFields.forEach(field => {
        const fieldConfig = schema.properties[field.key];
        const validators = [];
        
        if (field.required) {
          validators.push(Validators.required);
        }
        if(fieldConfig.widgetType == 'email'){
          validators.push(Validators.email);
        }

        // Handle different field types for default values
        let defaultValue: string | boolean | number | null = '';
        if (field.type === 'number') {
          defaultValue = null;
        } else if (field.type === 'boolean') {
          defaultValue = false;
        }

        formGroupConfig[field.key] = [defaultValue, validators];
      });
    }

    this.form = this.fb.group(formGroupConfig);
  }

    // Helper method to check if a field is required
    private isFieldRequired(fieldKey: string, requiredFields: string[] | undefined): boolean {
      return requiredFields ? requiredFields.includes(fieldKey) : false;
    }

  private determineFieldType(fieldConfig: any): string {
    // Use widgetType as primary indicator
    if (fieldConfig.widgetType) {
      switch (fieldConfig.widgetType) {
        case 'textArea':
          return 'string';
        case 'textBox':
          return 'string';
        case 'select':
          return 'select';
        case 'dropdown':
          return 'select';
        case 'checkbox':
          return 'boolean';
        case 'number':
          return 'number';
        default:
          return 'string';
      }
    }

    // Fallback to type analysis
    if (fieldConfig.type) {
      return fieldConfig.type;
    }

    if (fieldConfig.anyOf) {
      // Check if anyOf contains number types
      const hasNumber = fieldConfig.anyOf.some((typeDef: any) => 
        typeDef.type === 'number' || typeDef.type === 'integer'
      );
      if (hasNumber) return 'number';
      
      // Check if anyOf contains string types
      const hasString = fieldConfig.anyOf.some((typeDef: any) => 
        typeDef.type === 'string'
      );
      if (hasString) return 'string';
    }

    return 'string'; // Default to string
  }

  toggleMetadata(): void {
    this.showMetadata = !this.showMetadata;
  }

  onSubmit(): void {
    if (this.form.valid && !this.isSubmitted) {
      this.isSubmitting = true;
      
      const submitAction = this.formLayout.data.actions?.submit;
      // const formId = this.formLayout.data.metadata?.formId;
      const metadata = this.formLayout.data.metadata || {};

      if (submitAction?.type === 'tool' && submitAction.tool_name) {
        const formData = this.form.value;
            // Validate that at least one parameter is of type 'json' or 'form_data'
        if (!this.hasJsonParameter(submitAction.params)) {
          console.error('Form submission requires at least one json type parameter');
          this.isSubmitting = false;
          return;
        }

        // Build tool parameters based on server instructions
        const toolParams = this.buildToolParameters(
          this.form.value,
          submitAction.params,
          metadata
        );

      try {
          this.formSubmitted.emit({
          toolName: submitAction.tool_name,
          params: toolParams
        });
        // Mark form as submitted and readonly
          this.isSubmitted = true;
          this.disableForm();
      } catch (error) {
          console.error('Form submission error:', error);
          this.isSubmitting = false;
      }
    }

      this.isSubmitting = false;
    } else {
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.form);
    }
  }

   /**
   * Check if params configuration has at least one json type parameter
   */
  private hasJsonParameter(paramsConfig: any): boolean {
    if (!paramsConfig) return false;

    return Object.values(paramsConfig).some((paramConfig: any) => 
      paramConfig.type === 'json' || paramConfig.type === 'form_data'
    );
  }

  private buildToolParameters(formData: any, paramsConfig: any, metadata: any): any {
    const toolParams: any = {};

    if (!paramsConfig) {
      // Default: send form_data if no configuration provided
      return { form_data: formData };
    }

    Object.keys(paramsConfig).forEach(paramKey => {
      console.log("paramKey : ", paramKey);
      const paramConfig = paramsConfig[paramKey];
      
      switch (paramConfig.type) {
        case 'json':
        case 'form_data':
          // Send entire form data as JSON
          toolParams[paramKey] = formData;
          break;
        
        case 'metadata':
          // Get value from metadata field
          toolParams[paramKey] = this.getMetadataValue(paramConfig, metadata);
          break;
        
        case 'form_field':
          // Get specific field from form data
          toolParams[paramKey] = this.getFormFieldValue(paramConfig, formData);
          break;
        
        default:
          console.warn(`Unknown parameter type: ${paramConfig.type}`);
      }
    });

    return toolParams;
  }

  private getMetadataValue(paramConfig: any, metadata: any): any {
    console.log("Params config : ", paramConfig);
    console.log("metadata : ", metadata);

    const metadataField = paramConfig.field || paramConfig.source;
    
    if (metadataField) {
      // Support nested metadata fields (e.g., 'formId' or 'user.id')
      if (metadataField.includes('.')) {
        return this.getNestedValue(metadata, metadataField);
      }
      return metadata[metadataField];
    }
    
    // If no specific field specified, return entire metadata
    return metadata;
  }

   /**
   * Get nested object value using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

    /**
   * Get specific field from form data
   */
  private getFormFieldValue(paramConfig: any, formData: any): any {
    const fieldName = paramConfig.field || paramConfig.source;
    return formData[fieldName];
  }

  onCancel(): void {
    this.formCancelled.emit();
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  getMetadataEntries(metadata: any) {
    return Object.keys(metadata).map(key => ({
      key,
      value: metadata[key]
    }));
  }

   /**
   * Disable all form controls and mark as readonly
   */
  private disableForm(): void {
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      control?.disable();
    });
  }

    /**
   * Enable all form controls (if needed for reset functionality)
   */
  private enableForm(): void {
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      control?.enable();
    });
  }

}