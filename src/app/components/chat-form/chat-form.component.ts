import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { FormAction, FormActions, FormLayout } from '../models/message.model';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { finalize, Observable, of } from 'rxjs';
import { RestApiService } from '../../services/rest-api.service';
import { ApiFrammingService } from '../../services/api-framming.service';
@Component({
  selector: 'app-chat-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat-form.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './chat-form.component.css'
})
export class ChatFormComponent {
  @Input() formLayout!: FormLayout;
  @Output() formSubmitted = new EventEmitter<{toolName: string, params: any}>();
  @Output() formCancelled = new EventEmitter<void>();
  @Output() kanbanAction = new EventEmitter<any>();
  @Output() kanbanBoardUpdated = new EventEmitter<any>();

  formFields: any[] = [];
  showMetadata = false;
  isSubmitting = false;
  isSubmitted = false; 
  form: FormGroup;
  metadataEntries: any[] = [];
  formSubmittedMessage: string = '';
  constructor(private fb: FormBuilder, 
    private restApiService: RestApiService,
    private apiFrammingService: ApiFrammingService) {
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
    const metadata = this.formLayout.data.metadata || {};
    this.metadataEntries = this.getMetadataEntries(metadata);
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

        let defaultValue = fieldConfig.defaultValue;

        if (defaultValue === undefined || defaultValue === null) {
          if (field.type === 'number') defaultValue = null;
          else if (field.type === 'boolean') defaultValue = false;
          else defaultValue = '';
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
      const metadata = this.formLayout.data.metadata || {};
      const form_info = this.formLayout.data.form_info || {};
      const formData = this.form.value;

      if (!submitAction) {
        console.error('No submit action defined');
        this.isSubmitting = false;
        return;
      }

      if (submitAction?.type === 'tool' && submitAction.tool_name) {
        this.toolExecution(submitAction, metadata);
      }else if(submitAction?.type === 'api' && submitAction.url){
        // Implement API submission logic here if needed
        this.api_call_request(submitAction, metadata, form_info, formData);
      }

      this.isSubmitting = false;
    } else {
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.form);
    }
  }

  private toolExecution(submitAction: FormAction, metadata: {[key: string]: string}): void {
    // Placeholder for any pre-submission processing if needed
            const formData = this.form.value;
            // Validate that at least one parameter is of type 'json' or 'form_data'
        if (!this.hasJsonParameter(submitAction.params)) {
          console.error('Form submission requires at least one json type parameter');
          this.isSubmitting = false;
          return;
        }

        // Build tool parameters based on server instructions
        const toolParams = this.buildToolParameters(
          formData,
          submitAction.params,
          metadata
        );

      try {
          this.formSubmitted.emit({
          toolName: submitAction.tool_name? submitAction.tool_name : '',
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

  private api_call_request(action: FormAction, metadata: {[key: string]: string}, form_info: {[key: string]: string}, formData: {[key: string]: string}): void {
            // Validate that at least one parameter is of type 'json' or 'form_data'
        const requestConfig = this.apiFrammingService.buildApiRequest(action, metadata, form_info, formData);
        if (!requestConfig.success) {
          console.error('Failed to build request:', requestConfig.errors);
          this.isSubmitting = false;
          return;
        }
    this.executeApiAction(requestConfig)
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
        })
      )
      .subscribe({
        next: (response: any) => {
          console.log('Form submitted successfully:', response);
          const server_message = this.apiFrammingService.handleApiResponse(response, action);
          if(response && response.status === 200){
            this.formSubmittedMessage = server_message.message || 'Form submitted successfully.';
            this.isSubmitted = true;
            this.disableForm();
          }else {
            this.formSubmittedMessage = server_message.message || 'Form submittion failed.';
            console.error('API request failed:', response.error);
          }
        },
        error: (error: any) => {
          console.error('Form submission failed:', error);
        }
      });
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
      const paramConfig = paramsConfig[paramKey];
      
      switch (paramConfig.type) {
        case 'json':
        case 'form_data':
          // Send entire form data as JSON
          toolParams[paramKey] = formData;
          break;
        
        case 'metadata':
          // Get value from metadata field
          console.log("metadata ", toolParams[paramKey])
          toolParams[paramKey] = metadata[paramConfig.field];
          break;
        
        case 'form_info':
          // Get specific field from form data
          toolParams[paramKey] = formData[paramConfig.field];
          break;
        
        default:
          console.warn(`Unknown parameter type: ${paramConfig.type}`);
      }
    });

    return toolParams;
  }


  private executeApiAction(requestConfig: any): Observable<any> {
  if (!requestConfig.url) {
    return of({ success: false, error: 'API action missing URL' });
  }

  const method = requestConfig.method?.toUpperCase() || 'POST';
  const headers = requestConfig.headers || {};
  const payload = requestConfig.payload;

  switch (method) {
    case 'GET':
      return this.restApiService.getRequest(requestConfig.url, headers);

    case 'POST':
      return this.restApiService.postRequest(requestConfig.url, payload, headers);

    
    default:
      return of({ success: false, error: `Unsupported HTTP method: ${method}` });
  }
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

  onKanbanAction(event: any) {
    this.kanbanAction.emit(event);
  }
  
  onKanbanBoardUpdated(event: any) {
    this.kanbanBoardUpdated.emit(event);
  }

}