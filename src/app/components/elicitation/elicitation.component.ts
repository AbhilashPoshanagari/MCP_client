// elicitation.component.ts
import { Component, OnDestroy, OnInit, Output, EventEmitter, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { McpElicitationService } from '../../services/mcp/mcp-elicitation.service';
import { Observable, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { McpService } from '../../services/mcp.service';
import { NamedItem } from '../../common';

@Component({
  selector: 'app-elicitation',
  imports: [FormsModule, ReactiveFormsModule, CommonModule],
  templateUrl: './elicitation.component.html',
  styleUrls: ['./elicitation.component.css'],
  standalone: true
})
export class ElicitationComponent implements OnInit, OnDestroy, OnChanges {
  @Input() tool: NamedItem | null = null;
  form$: Observable<FormGroup | null>;
  schema$: Observable<any>;
  currentRequest: any;
  validationErrors: string[] = [];
  showConfirmation = false;
  submittedData: any;
  formAvailable: boolean = false;
  title: string = "";
  @Output() sendToolResponse = new EventEmitter<{request: string, response: string}>();
  private subscriptions: Subscription[] = [];

  constructor(
    private elicitationService: McpElicitationService, private mcpService: McpService
  ) {
    this.form$ = this.elicitationService.getCurrentForm();
    this.schema$ = this.elicitationService.getCurrentSchema();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if(!this.tool?.name && this.title != "Elicitation Request"){
      this.formAvailable = false;
    }
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.schema$.subscribe(schema => {
        this.currentRequest = schema?.schema;
        this.title = schema?.title;
        this.formAvailable = true;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

    confirmSubmission(confirm: boolean): void {
      // if(this.submittedData && this.submittedData.password){
      //   const password = data.password;
      //   const maskedPassword = password.length > 2 
      //   ? password[0] + '****' + password.slice(-1) 
      //   : '****';

      //   const partiallyMasked = { ...data, password: maskedPassword };
      //   console.log(partiallyMasked);
      // }

     if (confirm) {
      this.elicitationService.submitResponse({
        action: 'accept',
        content: this.submittedData
      });
    } else {
      this.elicitationService.submitResponse({
        action: 'decline'
      });
    }
    this.resetForm();
    this.formAvailable = false;
  }

  cancel(): void {
    if(this.title === "Elicitation Request"){
      this.elicitationService.submitResponse({
          action: 'cancel'
        });
    }else{
      console.log(this.title)
    }
    this.resetForm();
    this.formAvailable = false;
  }

  maskSensitiveData(data: any): any {    
    if(data.password){
      const password = data.password;
      const marked_password = password.length > 2 
        ? password.slice(0,3) + '****'
        : '****';
    return {
      ...data,
      password: marked_password // Mask the password
    };
    }
    return data;

  }

  onSubmit(form: FormGroup): void {
    if (form.invalid) {
      this.validationErrors = this.getFormErrors(form);
      return;
    }

    const formData = form.value;
    const isValid = this.elicitationService.validateAgainstSchema(formData, this.currentRequest);

    if (!isValid) {
      this.validationErrors = ['Data does not match the required schema.'];
      return;
    }
    this.submittedData = formData;
    if(this.title === "Tool test"){
      this.toolCall(formData)
    }else{
      this.showConfirmation = true;
    }
  }

  async toolCall(formData: any){
    if(this.tool?.name){
      try {
        let rag_response: any = {};
        if(this.tool?.description == "long running task"){
        rag_response = await this.mcpService.longRunningTool(this.tool?.name, formData);
        }else{
        rag_response = await this.mcpService.callTool(this.tool?.name, formData);
        }
        this.sendToolResponse.emit({request: JSON.stringify(formData), response : rag_response["content"][0]["text"]})
      } catch (error) {
        console.log("Sothing went worng : ", error)
      }
    }else {
      console.log("Tool name not received : ", this.tool?.name)
    }
    
  }

  private getFormErrors(form: FormGroup): string[] {
    const errors: string[] = [];
    Object.keys(form.controls).forEach(key => {
      const controlErrors = form.get(key)?.errors;
      if (controlErrors) {
        Object.keys(controlErrors).forEach(keyError => {
          errors.push(`${key}: ${this.getErrorMessage(keyError, controlErrors[keyError])}`);
        });
      }
    });
    return errors;
  }

  private getErrorMessage(errorName: string, errorValue: any): string {
    switch (errorName) {
      case 'required':
        return 'This field is required';
      case 'minlength':
        return `Minimum length is ${errorValue.requiredLength}`;
      case 'maxlength':
        return `Maximum length is ${errorValue.requiredLength}`;
      case 'min':
        return `Minimum value is ${errorValue.min}`;
      case 'max':
        return `Maximum value is ${errorValue.max}`;
      case 'email':
        return 'Invalid email format';
      default:
        return 'Invalid value';
    }
  }

  private resetForm(): void {
    this.validationErrors = [];
    this.showConfirmation = false;
    this.submittedData = null;
  }

  // Add these methods to the elicitation component
getFieldNames(schema: any): string[] {
  return schema ? Object.keys(schema.properties) : [];
}

getFieldType(schema: any, fieldName: string): string {
  if (!schema || !schema.properties[fieldName]) return 'string';
  const field = schema.properties[fieldName];
  if(fieldName === 'password'){
    return 'password';
  }
  if (field.enum) return 'enum';
  return field.type || 'string';
}

getFieldTitle(schema: any, fieldName: string): string {
  return schema?.properties[fieldName]?.title || fieldName;
}

getFieldDescription(schema: any, fieldName: string): string | null {
  return schema?.properties[fieldName]?.description || null;
}

getFieldDefault(schema: any, fieldName: string): any {
  return schema?.properties[fieldName]?.default;
}

getFieldMin(schema: any, fieldName: string): number | null {
  return schema?.properties[fieldName]?.minimum || null;
}

getFieldMax(schema: any, fieldName: string): number | null {
  return schema?.properties[fieldName]?.maximum || null;
}

getFieldOptions(schema: any, fieldName: string): any[] {
  return schema?.properties[fieldName]?.enum || [];
}

isFieldRequired(schema: any, fieldName: string): boolean {
  return schema?.required?.includes(fieldName) || false;
}

}