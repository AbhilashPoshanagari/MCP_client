import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { KanbanBoardData, KanbanCard, KanbanColumn } from '../components/models/message.model';

@Injectable({
  providedIn: 'root'
})
export class KanbanService {
  
  constructor(private http: HttpClient) {}
  
  /**
   * Parse MCP response into Kanban board data
   */
  parseMCPResponse(mcpResponse: any): KanbanBoardData {
    // MCP Response Format Example:
    // {
    //   "type": "kanban",
    //   "data": {
    //     "board_title": "Project Tasks",
    //     "columns": [
    //       {
    //         "id": "todo",
    //         "title": "To Do",
    //         "status": "todo",
    //         "cards": [
    //           {
    //             "id": "task-1",
    //             "title": "Implement feature X",
    //             "description": "Detailed description...",
    //             "priority": "high",
    //             "tags": ["frontend", "urgent"]
    //           }
    //         ]
    //       }
    //     ],
    //     "actions": {
    //       "add_card": {
    //         "type": "form",
    //         "title": "Add Card",
    //         "form_schema": {...}
    //       }
    //     }
    //   }
    // }
    
    const boardData = mcpResponse.data || mcpResponse;
    
    // Ensure cards have required fields
    if (boardData.columns) {
      boardData.columns.forEach((column: KanbanColumn) => {
        column.cards = column.cards.map(card => this.normalizeCard(card));
      });
    }
    
    return {
      board_title: boardData.board_title || 'Kanban Board',
      board_id: boardData.board_id,
      columns: boardData.columns || [],
      settings: boardData.settings,
      actions: boardData.actions,
      metadata: boardData.metadata || {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_cards: this.countTotalCards(boardData.columns)
      }
    };
  }
  
  /**
   * Normalize card data from MCP
   */
  private normalizeCard(cardData: any): KanbanCard {
    return {
      id: cardData.id || `card-${Date.now()}-${Math.random()}`,
      title: cardData.title || 'Untitled Card',
      description: cardData.description,
      assignee: cardData.assignee,
      assigneeAvatar: cardData.assignee_avatar,
      due_date: cardData.due_date || cardData.dueDate,
      tags: cardData.tags || [],
      priority: (cardData.priority || 'medium') as KanbanCard['priority'],
      status: (cardData.status || 'todo') as KanbanCard['status'],
      attachments: cardData.attachments,
      comments: cardData.comments || 0,
      created_at: cardData.created_at || new Date().toISOString(),
      updated_at: cardData.updated_at || new Date().toISOString(),
      metadata: cardData.metadata
    };
  }
  
  /**
   * Execute MCP action for Kanban operations
   */
  executeAction(action: any, payload: any): Observable<any> {
    switch (action.type) {
      case 'tool':
        return this.executeToolAction(action, payload);
      case 'api':
        return this.executeApiAction(action, payload);
      case 'form':
        return this.openForm(action, payload);
      default:
        return of({ success: false, error: 'Unknown action type' });
    }
  }
  
  private executeToolAction(action: any, payload: any): Observable<any> {
    // This would call your MCP server
    const toolCall = {
      tool_name: action.tool_name,
      arguments: payload
    };
    
    return this.http.post('/api/mcp/tools/execute', toolCall);
  }
  
  private executeApiAction(action: any, payload: any): Observable<any> {
    return this.http.request(
      action.method || 'POST',
      action.url,
      { body: payload }
    );
  }
  
  private openForm(action: any, payload: any): Observable<any> {
    // This would trigger a form modal in your app
    return new Observable(observer => {
      // Emit event to open form
      observer.next({ type: 'form_open', action, payload });
      observer.complete();
    });
  }
  
  /**
   * Update board state via MCP
   */
  updateBoard(boardData: KanbanBoardData, actionType: string): Observable<any> {
    const updatePayload = {
      board_id: boardData.board_id,
      action: actionType,
      data: boardData,
      timestamp: new Date().toISOString()
    };
    
    return this.http.post('/api/mcp/kanban/update', updatePayload).pipe(
      catchError(error => {
        console.error('Failed to update board via MCP:', error);
        return of({ success: false, error: error.message });
      })
    );
  }
  
  /**
   * Create new card via MCP
   */
  createCard(columnId: string, cardData: Partial<KanbanCard>): Observable<any> {
    const newCard = this.normalizeCard(cardData);
    
    return this.executeAction(
      { type: 'tool', tool_name: 'kanban_create_card' },
      { column_id: columnId, card: newCard }
    );
  }
  
  /**
   * Move card via MCP
   */
  moveCard(cardId: string, fromColumn: string, toColumn: string): Observable<any> {
    return this.executeAction(
      { type: 'tool', tool_name: 'kanban_move_card' },
      { card_id: cardId, from_column: fromColumn, to_column: toColumn }
    );
  }
  
  private countTotalCards(columns: KanbanColumn[] = []): number {
    return columns.reduce((sum, column) => sum + (column.cards?.length || 0), 0);
  }
}