import { Injectable } from '@angular/core';
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { 
  SystemMessagePromptTemplate, 
  HumanMessagePromptTemplate 
} from "@langchain/core/prompts";
// import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { OPENAI_API_KEY } from '../../../api_keys';
import { RestApiService } from './rest-api.service';
import { urls } from '../apiUrl';
import { of, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
// import { createToolCallingAgent } from "langchain/agents";

@Injectable({
  providedIn: 'root'
})
export class OpenAiService {
  openAI_key: string = OPENAI_API_KEY;
  langchain_model: any = null;
  openAi_format: string = urls.open_ai_funcs;
  openAI_agent: any;
  constructor(private restApiService: RestApiService) {
  }

 getOpenAIFunctions(): Observable<any> {
  if (!this.openAI_key) {
    console.error('OpenAI API key is not set.');
    return of({ status: 401, message: "OpenAI key not valid or not available" });
  } else {
    return this.restApiService.getRequest(this.openAi_format).pipe(
      map((funcs: any) => {
        if (funcs.status === 200) {
          return { status: funcs.status, open_ai: funcs.open_ai };
        } else {
          return { status: funcs.status, message: funcs.error };
        }
      }),
      catchError(() => of({ status: 500, message: "Something went wrong" }))
    );
  }
}

  getOpenAiClient() {
    if (!this.openAI_key) {
      throw new Error('OpenAI API key is not set');
    }
    if (this.langchain_model) {
      return this.langchain_model;
    }
    
   this.langchain_model = new ChatOpenAI({
                        apiKey: this.openAI_key,
                        model: 'gpt-4o-mini',
                        temperature: 0,
                        maxTokens: 512,
                        streaming: true
                        });                   
    return this.langchain_model
  }

openAImodels(type: string = "langchain", open_ai_model:any, tools: Array<any>, systemPrompt: string, humanPrompt: string) {
    let llm_with_functions: any;
    if(type=="langgraph"){
      llm_with_functions = createReactAgent({
                  llm: open_ai_model,
                  tools: tools
                });
    }else if(type=="langchain"){
      llm_with_functions = open_ai_model.bindTools(tools, {tool_choice: "auto"});
    }
    const prompt = ChatPromptTemplate.fromMessages([
          SystemMessagePromptTemplate.fromTemplate(systemPrompt),
          HumanMessagePromptTemplate.fromTemplate(humanPrompt)
        ]);

    // const agent = await createToolCallingAgent({ llm: llm_with_functions, tools, prompt });
    return {mode_with_tools: llm_with_functions, overall_prompt: prompt};      
  }
  
}
