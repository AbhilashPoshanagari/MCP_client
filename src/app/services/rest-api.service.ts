import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { map, catchError } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RestApiService {
  private authToken: string | null = null;
  private apiKey: string | null = null;
  private authStrategy: 'bearer_token' | 'basic_auth' | 'api_key' | 'none' = 'none';
  constructor(private httpClient: HttpClient){

  }

   getRequest(url: string, customHeaders: {[key: string]: string} = {}): Observable<{status: number, data?: any, error?: string}> {
    // const headers = this.getAuthHeaders()? this.;
    const headers = this.getAuthHeaders();
    
    if (customHeaders) {
      Object.keys(customHeaders).forEach(key => {
        headers.set(key, customHeaders[key]);
      });
    }
    return this.httpClient.get<any>(url, { headers, observe: 'response' }).pipe(
      map((res) => {
        if (res.status === 200) {
          return {status: res.status, data: res.body.data };
        } else {
          return { status: 500, error: 'something went wrong' };
        }
      }),
      catchError((err) => {
        console.error('API error:', err);
        return of({ status:500, error: 'API request failed' });
      })
    );
  }

  postRequest(url: string, reqBody: {[key: string]: any}, customHeaders: {[key: string]: string} = {}) {
    const headers = this.getAuthHeaders();
    
    if (customHeaders) {
      Object.keys(customHeaders).forEach(key => {
        headers.set(key, customHeaders[key]);
      });
    }

    return this.httpClient.post<any>(url, reqBody, { headers, observe: 'response' }).pipe(
      map((res) => {
        if (res.status === 200) {
          return {status: res.status, data: res.body.data };
        } else {
          return { status: 500, error: 'something went wrong' };
        }
      }),
      catchError((err) => {
        console.error('API error:', err);
        return of({ error: 'API request failed' });
      })
    );
  }

  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    switch (this.authStrategy) {
      case 'bearer_token':
        if (this.authToken) {
          headers = headers.set('Authorization', `Bearer ${this.authToken}`);
        }
        break;
      
      case 'basic_auth':
        if (this.authToken) {
          headers = headers.set('Authorization', `Basic ${btoa(this.authToken)}`);
        }
        break;
      
      case 'api_key':
        if (this.apiKey) {
          headers = headers.set('X-API-Key', this.apiKey);
        }
        break;
      
      case 'none':
        // No authentication headers
        break;
    }

    return headers;
  }

}
