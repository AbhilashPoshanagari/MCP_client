import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideMarkdown } from 'ngx-markdown';
// Import ModuleRegistry and the required module
import {
    ModuleRegistry,
    AllCommunityModule, // or AllEnterpriseModule
} from 'ag-grid-community';

// Register the module
ModuleRegistry.registerModules([
    AllCommunityModule, // or AllEnterpriseModule
]);

import { provideGlobalGridOptions } from 'ag-grid-community';
provideGlobalGridOptions({ theme: "legacy" });
export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), 
    provideRouter(routes),
    provideMarkdown(),
    provideHttpClient(withInterceptorsFromDi())
  ]
};
