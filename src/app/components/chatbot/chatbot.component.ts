import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';

@Component({
  selector: 'app-chatbot',
  imports: [FormsModule, CommonModule, MarkdownModule],
  templateUrl: './chatbot.component.html',
  styleUrl: './chatbot.component.css',
  standalone: true
})
export class ChatbotComponent {
  @Input() messages: any[] = [];

  constructor() {}
  // This method will handle the user message and simulate a response
  handleUserMessage(msg: string) {
    this.messages.push({ role: 'user', content: msg });
    // For now, we will just simulate a response
    console.log(this.messages)
    setTimeout(() => {
      this.messages.push({ role: 'assistant', content: `Response to: ${msg}` });
    }, 1000);
  }
}
