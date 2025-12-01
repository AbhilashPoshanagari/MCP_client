import { Injectable } from '@angular/core';
import { ChatOpenAI, AzureChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { 
  SystemMessagePromptTemplate, 
  HumanMessagePromptTemplate 
} from "@langchain/core/prompts";
import { AzureOpenAI } from "openai";

// import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { RestApiService } from './rest-api.service';
import { of, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
// import { createToolCallingAgent } from "langchain/agents";
// import "dotenv/config";
import { environment } from '../../environments/environment';
import { OpenAiConfig } from '../common';
@Injectable({
  providedIn: 'root'
})
export class OpenAiService {
  langchain_model: any = null;
  openAI_agent: any;

  constructor() {
  }

  // getOpenAiClient(openAIKey: string) {
  //   if (!openAIKey) {
  //     throw new Error('OpenAI API key is not set');
  //   }
  //   if (this.langchain_model) {
  //     delete this.langchain_model;
  //   }
    
  //  this.langchain_model = new ChatOpenAI({
  //                       apiKey: openAIKey,
  //                       model: 'gpt-4o-mini',
  //                       temperature: 0,
  //                       maxTokens: 4096,
  //                       streaming: true
  //                       });                   
  //   return this.langchain_model
  // }

    getOpenAiClient(open_ai_config: OpenAiConfig) {
    if (!open_ai_config.openAIKey) {
      throw new Error('OpenAI API key is not set');
    }
    if (this.langchain_model) {
      delete this.langchain_model;
    }
    
   this.langchain_model = new ChatOpenAI({
                        apiKey: open_ai_config.openAIKey,
                        model: open_ai_config.model || 'gpt-4o-mini',
                        temperature: open_ai_config.temparature || 0,
                        maxTokens: open_ai_config.maxToken || 4096,
                        streaming: open_ai_config.streaming || true
                        });                   
    return this.langchain_model
  }

openAImodels(type: string = "langchain", open_ai_model:any, tools: Array<any>, systemPrompt: string, humanPrompt: string) {
    let llm_with_functions: any = null;
    let llm_with_out_functions: any = null;
    // let open_ai_raw_model: any = null;
    // console.log("Tools : ", tools)
    if(type=="langgraph"){
      llm_with_functions = createReactAgent({
                  llm: open_ai_model,
                  tools: tools
                });
    }else if(type=="langchain" && tools.length > 0){
      llm_with_functions = open_ai_model.bindTools(tools, {tool_choice: "auto"});
    }else if(type=="langchain" && tools.length == 0){
      llm_with_out_functions = open_ai_model;
    }
    
    const prompt = ChatPromptTemplate.fromMessages([
          SystemMessagePromptTemplate.fromTemplate(systemPrompt),
          HumanMessagePromptTemplate.fromTemplate(humanPrompt)
        ]);

    // const agent = await createToolCallingAgent({ llm: llm_with_functions, tools, prompt });
    return {model_with_tools: llm_with_functions, overall_prompt: prompt, model_with_out_tools: llm_with_out_functions};      
  }
  
}
