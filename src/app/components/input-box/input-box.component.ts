import { Component, EventEmitter, Output, OnInit, afterNextRender,
  OnDestroy, inject, Injector, ViewChild } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common'; 
// import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatInput, MatInputModule } from '@angular/material/input';
// import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuTrigger } from '@angular/material/menu';
import { McpService } from '../../services/mcp.service';
import { NamedItem } from '../../common'; // Assuming you have a common.ts file for interfaces
import { Subscription } from 'rxjs';
import { filter } from 'rxjs';
import { MatChipsModule } from '@angular/material/chips';
import {CdkTextareaAutosize, TextFieldModule} from '@angular/cdk/text-field';

@Component({
  selector: 'app-input-box',
  imports: [FormsModule, ReactiveFormsModule, CommonModule, MatMenuModule, 
    MatIconModule, MatInputModule, MatFormFieldModule, MatMenuTrigger, MatChipsModule,
    TextFieldModule],
  templateUrl: './input-box.component.html',
  styleUrl: './input-box.component.css',
  standalone: true
})
export class InputBoxComponent implements OnInit, OnDestroy {
  private _injector = inject(Injector);
  @ViewChild('autosize') autosize!: CdkTextareaAutosize;

  @Output() sendMessage = new EventEmitter<string>();
  @Output() sendTool = new EventEmitter<NamedItem | null>();
  @Output() sendResource = new EventEmitter<string>();
  @Output() sendPrompt = new EventEmitter<string>();
  message = '';
  showToolsMenu = false;
  showResourcesMenu = false;
  showPromptsMenu = false;

  tools:Array<NamedItem> = [];
  resources:Array<NamedItem> = [];
  prompts: Array<NamedItem> = [];

  selectedTool: NamedItem | null = null;
  selectedResource: NamedItem | null = null;
  selectedPrompt: NamedItem | null = null;
  isConnected: boolean = false;
  private subs = new Subscription();
  constructor(private mcpService: McpService) {

  }

  ngOnInit(): void {
    this.subs.add(
          this.mcpService.connectionStatus$
            .pipe(filter(status => status === true))  // <--- FIXED HERE
            .subscribe((state) => {
              console.log("mcp input-box : ", state)
              this.subs.add(this.mcpService.tools$.subscribe(tools => this.tools = tools));
              this.subs.add(this.mcpService.promtps$.subscribe(prompts => this.prompts = prompts));
              this.subs.add(this.mcpService.resources$.subscribe(resources => this.resources = resources));
            })
        );
    this.triggerResize()
  }


   triggerResize() {
    // Wait for content to render, then trigger textarea resize.
    afterNextRender(
      () => {
        this.autosize.resizeToFitContent(true);
      },
      {
        injector: this._injector,
      },
    );
  }

   submitMessage() {
    if (this.message.trim()) {
      // Your message submission logic
      console.log('Message sent:', this.message.trim());
      this.sendMessage.emit(this.message.trim());
      this.message = '';
    }
  }

  selectTool(selected_tool: NamedItem) {
    if(this.selectedTool){
      this.tools.push(this.selectedTool)
    }
    this.tools = this.tools.filter(tool => tool.name !== selected_tool.name);
    this.selectedTool = selected_tool;
    this.showToolsMenu = false;
    this.sendTool.emit(this.selectedTool)
  }

  selectResource(selected_resource: NamedItem) {
    if(this.selectedResource){
      this.resources.push(this.selectedResource);
    }
    this.resources = this.resources.filter(resource => resource.name !== selected_resource.name);
    this.selectedResource = selected_resource;
    this.showResourcesMenu = false;
    // this.mcpService.readResource()
  }

  selectPrompt(selected_prompt: NamedItem) {
     if(this.selectedPrompt){
      this.prompts.push(this.selectedPrompt);
    }
    this.prompts = this.prompts.filter(prompt => prompt.name !== selected_prompt.name);
    this.selectedPrompt = selected_prompt;
    this.showPromptsMenu = false;
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  clearSelection(selectedItem: string, item: NamedItem){
    switch (selectedItem) {
      case 'prompt':
        this.selectedPrompt = null;
        this.prompts.push(item)
        break;
      case 'resource':
        this.selectedResource = null;
        this.resources.push(item)
      break;
      case 'tool':
        this.selectedTool = null;
        this.tools.push(item)
        this.sendTool.emit(this.selectedTool)
      break;
    
      default:
        break;
    }
  }
  
}
