import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ApiFrammingService {


  buildApiRequest(action: any, metadata: any, form_info: any, formData: any): any {
      const result = {
        success: true,
        errors: [] as string[],
        payload: {} as any,
        url: action.url,
        method: action.method || 'POST',
        headers: {} as any
      };

      // Build URL with path parameters
      if (action.params?.path) {
        result.url = this.buildUrlWithPathParams(result.url, action.params.path, metadata, form_info, result.errors);
      }

      // Build query parameters for GET/DELETE
      if (['GET', 'DELETE'].includes(result.method.toUpperCase()) && action.params?.query) {
        const queryParams = this.buildQueryParams(action.params.query, metadata, form_info, formData, result.errors);
        if (Object.keys(queryParams).length > 0) {
          result.url += `?${new URLSearchParams(queryParams).toString()}`;
        }
      }

      // Build request body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(result.method.toUpperCase()) && action.params?.body) {
        result.payload = this.buildRequestBody(action.params.body, metadata, form_info, formData, result.errors);
      }

      // Apply authentication strategy
      // this.applyAuthStrategy(action, result);

      // Check for missing required parameters
      this.validateRequiredParams(action.params, metadata, form_info, formData, result.errors);

      result.success = result.errors.length === 0;
      return result;
    }

  private buildUrlWithPathParams(url: string, pathParams: any, metadata: any, form_info: any, errors: string[]): string {
      let processedUrl = url;
      
      Object.keys(pathParams).forEach(paramName => {
        const paramConfig = pathParams[paramName];
        const paramValue = this.getParameterValue(paramConfig, metadata,form_info, {}, 'path');
        
        if (paramValue === undefined || paramValue === null) {
          if (paramConfig.required !== false) {
            errors.push(`Missing required path parameter: ${paramName}`);
          }
          return;
        }
        
        processedUrl = processedUrl.replace(`{${paramName}}`, encodeURIComponent(paramValue));
      });

      // Check if any placeholders remain
      const remainingPlaceholders = processedUrl.match(/{([^}]+)}/g);
      if (remainingPlaceholders) {
        errors.push(`Unresolved path parameters: ${remainingPlaceholders.join(', ')}`);
      }

      return processedUrl;
    }

    private buildQueryParams(queryParams: any, metadata: any, form_info: any, formData: any, errors: string[]): any {
      const params: any = {};
      
      Object.keys(queryParams).forEach(paramName => {
        const paramConfig = queryParams[paramName];
        const paramValue = this.getParameterValue(paramConfig, metadata, form_info, formData, 'query');
        
        if (paramValue !== undefined && paramValue !== null) {
          params[paramName] = paramValue;
        } else if (paramConfig.required !== false) {
          errors.push(`Missing required query parameter: ${paramName}`);
        }
      });
      
      return params;
    }

  private buildRequestBody(bodyParams: any, metadata: any, form_info: any, formData: any, errors: string[]): any {
      const body: any = {};
      
      Object.keys(bodyParams).forEach(paramName => {
        const paramConfig = bodyParams[paramName];
        const paramValue = this.getParameterValue(paramConfig, metadata, form_info, formData, 'body');
        
        if (paramValue !== undefined && paramValue !== null) {
          body[paramName] = paramValue;
        } else if (paramConfig.required !== false) {
          errors.push(`Missing required body parameter: ${paramName}`);
        }
      });
      
      return body;
    }

  private getParameterValue(paramConfig: any, metadata: any, form_info: any, formData: any, paramType: string): any {
      switch (paramConfig.type) {
        case 'json':
        case 'form_data':
          return formData;
        
        case 'metadata':
          if (Array.isArray(paramConfig.field)) {
            // Return object with multiple metadata fields
            const result: any = {};
            paramConfig.field.forEach((field: string) => {
              result[field] = metadata[field];
            });
            return result;
          } else if (paramConfig.field === 'metadata') {
            // Return entire metadata object
            return metadata;
          } else {
            // Return single metadata field
            return metadata[paramConfig.field];
          }
        
        case 'form_info':
            if (Array.isArray(paramConfig.field)) {
              // Return object with multiple metadata fields
              const result: any = {};
              paramConfig.field.forEach((field: string) => {
                result[field] = form_info[field];
              });
              return result;
            } else if (paramConfig.field === 'form_info') {
              // Return entire metadata object
              return form_info;
            } else {
              // Return single metadata field
              return form_info[paramConfig.field];
            }
        
        default:
          console.warn(`Unknown parameter type: ${paramConfig.type} for ${paramType} parameter`);
          return undefined;
      }
    }

  private validateRequiredParams(params: any, metadata: any, form_info: any, formData: any, errors: string[]): void {
      if (!params) return;

      const checkParams = (paramSet: any, paramType: string) => {
        if (!paramSet) return;
        
        Object.keys(paramSet).forEach(paramName => {
          const paramConfig = paramSet[paramName];
          if (paramConfig.required !== false) {
            const value = this.getParameterValue(paramConfig, metadata, form_info, formData, paramType);
            if (value === undefined || value === null) {
              errors.push(`Missing required ${paramType} parameter: ${paramName}`);
            }
          }
        });
      };

      checkParams(params.path, 'path');
      checkParams(params.query, 'query');
      checkParams(params.body, 'body');
  }

  handleApiResponse(response: any, action: any) {
  const format = action.response_format || {};
  
  // Extract values using path notation
  const getValue = (path: string, obj: any) => {
    if (!path) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  };
  
  const successValue = getValue(format.success_path, response) || response.success;
  const isSuccess = successValue === (format.success_value || 'success');
  
  if (isSuccess) {
    // Success handling
    const message = getValue(format.message_path, response) || response.message;
    const redirectUrl = getValue(format.redirect_path, response);
    const data = getValue(format.data_path, response) || response.data;
    
    // Show success message
    if (message) {
      return { message: message || 'success'};
    }
    
    // Redirect if URL provided
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
    
    // Emit success event with data
    // this.formSubmitSuccess.emit(data);
    if(typeof data === 'string'){
      return {message: data};
    }else if(typeof data === 'object' && data !== null){
      return {message: JSON.stringify(data)};
    }else{
      return {message: 'success'};
    }
  } else {
    // Error handling
    const errorMessage = getValue(format.error_path, response) || 
                         response.error || 
                         'Submission failed';
    
    return {message: errorMessage || 'error'};
    // this.formSubmitError.emit(errorMessage);
  }
}
  
}
