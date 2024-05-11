

import { LLM_API, ModelType } from "./types";
import { CreateChatCompletionRequest, ChatCompletionContent, EmptyCompletionContent, CreateChatCompletionResponse } from "./types";
import { ModelConfig, MultimodalContent } from "./types";


import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";


export class BedrockChatCompletionContent implements ChatCompletionContent {
  private readonly body: any;
  // private readonly stopWords: string[];

  constructor(body: any) {
    this.body = body;
    // this.stopWords = stopWords;
  }



  // stop words in OpenAI api don't always work.
  // So we have to truncate on our side.
  async *read() {

    for await (const item of this.body) {
      // console.log('for loop, item', item);
      if (item.chunk?.bytes) {
        const decodedResponseBody = new TextDecoder().decode(
          item.chunk.bytes,
        );
        const responseBody = JSON.parse(decodedResponseBody);

        // console.log("streaming response:", responseBody);

        if (responseBody.delta?.type === "text_delta") {
          // console.log('delta', responseBody.delta.text);

          yield responseBody.delta.text;
          return;
        }

        if (responseBody.type === "message_stop") {
          //remainText += JSON.stringify(responseBody["amazon-bedrock-invocationMetrics"]);
          // metrics = responseBody["amazon-bedrock-invocationMetrics"];
        }
      }
    }

    yield ' ';

  }

  async readAll() {


    let allContent = '';

    for await (const item of this.body) {
      // console.log('for loop, item', item);
      if (item.chunk?.bytes) {
        const decodedResponseBody = new TextDecoder().decode(
          item.chunk.bytes,
        );
        const responseBody = JSON.parse(decodedResponseBody);

        // console.log("streaming response:", responseBody);

        if (responseBody.delta?.type === "text_delta") {
          // console.log('delta', responseBody.delta.text);

          allContent += responseBody.delta.text;
        }

        if (responseBody.type === "message_stop") {
          //remainText += JSON.stringify(responseBody["amazon-bedrock-invocationMetrics"]);
          // metrics = responseBody["amazon-bedrock-invocationMetrics"];
        }
      }
    }

    return allContent;
  }


}

export class BedrockChatCompletionContentMistral implements ChatCompletionContent {
  private readonly body: any;
  // private readonly stopWords: string[];

  constructor(body: any) {
    this.body = body;
    // this.stopWords = stopWords;
  }



  // stop words in OpenAI api don't always work.
  // So we have to truncate on our side.
  async *read() {

    for await (const item of this.body) {
      // console.log('for loop, item', item);
      if (item.chunk?.bytes) {
        const decodedResponseBody = new TextDecoder().decode(
          item.chunk.bytes,
        );
        const responseBody = JSON.parse(decodedResponseBody);

        // console.log("streaming response:", responseBody);

        if (responseBody.delta?.type === "text_delta") {
          // console.log('delta', responseBody.delta.text);

          yield responseBody.delta.text;
          return;
        }

        if (responseBody.type === "message_stop") {
          //remainText += JSON.stringify(responseBody["amazon-bedrock-invocationMetrics"]);
          // metrics = responseBody["amazon-bedrock-invocationMetrics"];
        }
      }
    }

    yield ' ';

  }

  async readAll() {


    let allContent = '';

    for await (const item of this.body) {
      // console.log('for loop, item', item);
      if (item.chunk?.bytes) {
        const decodedResponseBody = new TextDecoder().decode(
          item.chunk.bytes,
        );
        const responseBody = JSON.parse(decodedResponseBody);

        // console.log("streaming response:", responseBody);

        for (const output_item of responseBody.outputs) {
          allContent += output_item.text;
        }



        // if (responseBody.delta?.type === "text_delta") {
        //   // console.log('delta', responseBody.delta.text);

        // allContent += responseBody.text;
        // }

        // if (responseBody.type === "message_stop") {
        //   //remainText += JSON.stringify(responseBody["amazon-bedrock-invocationMetrics"]);
        //   // metrics = responseBody["amazon-bedrock-invocationMetrics"];
        // }
      }
    }

    // console.log('Mistral response: all content:', allContent);
    return allContent;
  }


}




export class awsBedrock implements LLM_API {

  private client: BedrockRuntimeClient = new BedrockRuntimeClient({ region: "us-west-2" });


  // private model_config: ModelConfig = {
  //   model: "claude-3-sonnet",
  //   model_type: ModelType.Claude3,
  //   top_p: 0.9,
  //   temperature: 0.9,
  //   max_tokens: 500,
  //   model_id: "anthropic.claude-3-sonnet-20240229-v1:0",
  //   anthropic_version: "bedrock-2023-05-31",
  // };

  private model_config: ModelConfig = {
    model: "mistral-8x7b",
    model_type: ModelType.Mistral,
    top_p: 0.9,
    temperature: 0.9,
    max_tokens: 500,
    model_id: "mistral.mixtral-8x7b-instruct-v0:1",
  };






  constructor(llm_model: string) {



  }

  convertMessagePayloadMistral(messages: any, modelConfig: ModelConfig): any {

    // var new_messages: any = [];

    var has_system_prompt = false;
    var system_prompt = "";
    var prev_role = "";

    var prompt_string = "<s>[INST]";

    for (var i = 0; i < messages.length; i++) {
      if (messages[i].role === "system") {
        if (has_system_prompt) {
          // only first system prompt is used
          continue;
        } else {
          if (typeof messages[i].content === "string") {
            has_system_prompt = true;

            prompt_string += messages[i].content;

          }
        }
      } else if (messages[i].role === "user") {
        // check the value type of the content

        var new_contents = [];


        if (typeof messages[i].content === "string") {
          // the message content is not an array, it is a text message

          const content_string =
            messages[i].content == "" ? "' '" : messages[i].content;

          // const text_playload = { type: "text", text: content_string };

          new_contents.push(content_string);
        } else {
          for (var j = 0; j < messages[i].content.length; j++) {
            if ((messages[i].content[j] as MultimodalContent).type === "image_url") {
              new_contents.push("image");
            } else {
              const content_string =
                messages[i].content[j] == "" ? "' '" : messages[i].content[j];
              new_contents.push(content_string);
            }
          }
        }

        prompt_string += "<u>" + new_contents.join(" ") + "</u>";

        prev_role = messages[i].role;

        // console.log("now , new message is:", new_messages);
      } else if (messages[i].role === "assistant") {
        var new_contents = [];



        if (typeof messages[i].content === "string") {
          // the message content is not an array, it is a text message
          const message_contest_string =
            messages[i].content == "" ? "' '" : messages[i].content;
          const text_playload = { type: "text", text: message_contest_string };

          new_contents.push(text_playload);
        } else {
          for (var j = 0; j < messages[i].content.length; j++) {
            const message_content =
              messages[i].content[j] == "" ? "' '" : messages[i].content[j];
            new_contents.push(message_content);
          }
        }

        prompt_string += "<a>" + new_contents.join(" ") + "</a>";

        prev_role = messages[i].role;
      } else {
        const message_content = messages[i] == "" ? "' '" : messages[i];

        prompt_string += "<u>" + message_content + "</u>";

        prev_role = messages[i].role;
      }
    }

    prompt_string += "[/INST]";

    const requestPayload = {

      prompt: prompt_string,

      temperature: modelConfig.temperature,
      max_tokens: modelConfig.max_tokens,

    };

    return requestPayload;

  }

  convertMessagePayloadClaude3(
    messages: any,
    modelConfig: ModelConfig,
  ): any {
    // converting the message payload, as the format of the original message playload is different from the format of the payload format of Bedrock API
    // define a new variable to store the new message payload,
    // scan all the messages in the original message payload,
    //      if the message is a system prompt, then need to remove it from the message payload, and store the system prompt content in "system parameter" as Bedrock API required.
    //      if the message is from user, then scan the content of the message
    //          if the content type is image_url, then get the image data and store it in the new message payload
    //          if the content type is not image_url, then store the content in the new message payload

    // console.log("original messages", messages);

    var new_messages: any = [];

    var has_system_prompt = false;
    var system_prompt = "";
    var prev_role = "";

    for (var i = 0; i < messages.length; i++) {
      if (messages[i].role === "system") {
        if (has_system_prompt) {
          // only first system prompt is used
          continue;
        } else {
          if (typeof messages[i].content === "string") {
            has_system_prompt = true;
            if (messages[i].content !== "") {
              system_prompt = messages[i].content;
            } else {
              system_prompt = "' '";
            }
          }
        }
      } else if (messages[i].role === "user") {
        // check the value type of the content

        var new_contents = [];

        if (prev_role === messages[i].role) {
          // continued user message
          // need to get back the previous user message, and append the current message to the previous message

          const last_message = new_messages.pop();

          // put the contents in the last message to the new contents

          for (var k = 0; k < last_message.content.length; k++) {
            if (last_message.content[k] !== "") {
              new_contents.push(last_message.content[k]);
            } else {
              new_contents.push("' '");
            }
          }
        }

        if (typeof messages[i].content === "string") {
          // the message content is not an array, it is a text message

          const content_string =
            messages[i].content == "" ? "' '" : messages[i].content;

          const text_playload = { type: "text", text: content_string };

          new_contents.push(text_playload);
        } else {
          for (var j = 0; j < messages[i].content.length; j++) {
            if (
              (messages[i].content[j] as MultimodalContent).type === "image_url"
            ) {
              const curent_content = messages[i].content[
                j
              ] as MultimodalContent;

              // console.log('image_url', curent_content.image_url.url);

              if (curent_content.image_url !== undefined) {
                const image_data_in_string = curent_content.image_url.url;

                const image_metadata = image_data_in_string.split(",")[0];
                const image_data = image_data_in_string.split(",")[1];

                const media_type = image_metadata.split(";")[0].split(":")[1];
                const image_type = image_metadata.split(";")[1];

                const image_playload = {
                  type: "image",
                  source: {
                    type: image_type,
                    media_type: media_type,
                    data: image_data,
                  },
                };

                new_contents.push(image_playload);
              }
            } else {
              const content_string =
                messages[i].content[j] == "" ? "' '" : messages[i].content[j];
              new_contents.push(content_string);
            }
          }
        }

        new_messages.push({ role: messages[i].role, content: new_contents });

        prev_role = messages[i].role;

        // console.log("now , new message is:", new_messages);
      } else if (messages[i].role === "assistant") {
        var new_contents = [];

        if (prev_role === messages[i].role) {
          // continued assistant message
          // need to get back the previous assistant message, and append the current message to the previous message

          const last_message = new_messages.pop();

          // put the contents in the last message to the new contents

          for (var k = 0; k < last_message.content.length; k++) {
            const content_string =
              last_message.content[k] == "" ? "' '" : last_message.content[k];
            new_contents.push(last_message.content[k]);
          }
        }

        if (typeof messages[i].content === "string") {
          // the message content is not an array, it is a text message
          const message_contest_string =
            messages[i].content == "" ? "' '" : messages[i].content;
          const text_playload = { type: "text", text: message_contest_string };

          new_contents.push(text_playload);
        } else {
          for (var j = 0; j < messages[i].content.length; j++) {
            const message_content =
              messages[i].content[j] == "" ? "' '" : messages[i].content[j];
            new_contents.push(message_content);
          }
        }

        new_messages.push({ role: messages[i].role, content: new_contents });

        prev_role = messages[i].role;
      } else {
        const message_content = messages[i] == "" ? "' '" : messages[i];
        new_messages.push(message_content);

        prev_role = messages[i].role;
      }
    }

    const requestPayload = {
      ...(has_system_prompt ? { system: system_prompt } : {}),
      messages: new_messages,
      top_p: modelConfig.top_p,
      temperature: modelConfig.temperature,
      max_tokens: modelConfig.max_tokens,
      anthropic_version: modelConfig.anthropic_version,
    };

    return requestPayload;
  }


  async invokeModelWithStream(payload: any, modelId: string) {
    const input = {
      body: JSON.stringify(payload),
      contentType: "application/json",
      accept: "application/json",
      modelId,
    };

    const command = new InvokeModelWithResponseStreamCommand(input);
    return this.client.send(command);
  }

  async invokeModel(payload: any, modelId: string) {
    const input = {
      body: JSON.stringify(payload),
      contentType: "application/json",
      accept: "application/json",
      modelId,
    };

    const command = new InvokeModelCommand(input);
    return this.client.send(command);
  }

  convertMessagePayload(
    messages: any,
    modelConfig: ModelConfig,
  ): any {

    if (modelConfig.model_type === ModelType.Claude3) {
      return this.convertMessagePayloadClaude3(messages, modelConfig);
    } else if (modelConfig.model_type === ModelType.Mistral) {
      return this.convertMessagePayloadMistral(messages, modelConfig);
    } else {
      return this.convertMessagePayloadClaude3(messages, modelConfig);
    }
  }

  async chatCompletion(
    body: Omit<CreateChatCompletionRequest, 'model'> & {
      model?: CreateChatCompletionRequest['model'];
    }
  ) {

    const new_message_payload = this.convertMessagePayload(body.messages, this.model_config);

    const response = await this.invokeModel(new_message_payload, this.model_config.model_id);

    if (response.body) {
      // console.log('response', response.body);

      if (this.model_config.model_type === ModelType.Mistral) {

        const decodedResponseBody = new TextDecoder().decode(response.body);
        const responseBody = JSON.parse(decodedResponseBody);

        var message = '';

        for (const output_item of responseBody.outputs) {
          message += output_item.text;
        }



        return message;


      } else if (this.model_config.model_type === ModelType.Claude3) {

        const decodedResponseBody = new TextDecoder().decode(response.body);
        const responseBody = JSON.parse(decodedResponseBody);

        const message = responseBody.content[0]["text"];

        return message;
      } else {
        const decodedResponseBody = new TextDecoder().decode(response.body);
        const responseBody = JSON.parse(decodedResponseBody);

        const message = responseBody.content[0]["text"];

        return message;
      }

    }
    else {
      console.log('no response');
    }
  }




  async chatCompletionStream(
    body: Omit<CreateChatCompletionRequest, 'model'> & {
      model?: CreateChatCompletionRequest['model'];
    }
  ) {

    // console.log('------------------------------------------');
    // console.log(body);
    // build a string with current time stamp as dummy content


    const new_message_payload = this.convertMessagePayload(body.messages, this.model_config);

    // console.log(new_message_payload);

    const response = await this.invokeModelWithStream(new_message_payload, this.model_config.model_id);

    if (response.body) {
      // console.log('streaming response', response.body);

      if (this.model_config.model_type === ModelType.Mistral) {
        return new BedrockChatCompletionContentMistral(response.body);
      } else if (this.model_config.model_type === ModelType.Claude3) {
        return new BedrockChatCompletionContent(response.body);
      } else {
        return new BedrockChatCompletionContent(response.body);
      }


    }
    else {
      console.log('no response');
    }

    return new EmptyCompletionContent();
  }

  async fetchEmbedding(text: string) {
    const { embeddings, ...stats } = await this.fetchEmbeddingBatch([text]);
    return { embedding: embeddings[0], ...stats };
  }

  async fetchEmbeddingBatch(texts: string[]) {
    // dummy function
    // return a sample object match the return type

    const cohere_model_id = "cohere.embed-multilingual-v3";

    const embeddings = [];

    const payload = {
      texts: texts,
      input_type: "search_document",
      truncate: "END",
    };

    const response = await this.invokeModel(payload, cohere_model_id);


    const decodedResponseBody = new TextDecoder().decode(response.body);

    const responseBody = JSON.parse(decodedResponseBody);

    // console.log("aws bedrock cohere response: =====================")

    // console.log(responseBody);



    // if (response.body) {

    //   // const return_result = JSON.parse(response.body as string).embedding as number[] };
    //   // const responseBody = JSON.parse(response.body as string);

    //   for (var i = 0; i < responseBody.length; i++) {
    //     embeddings.push(responseBody[i].embedding);
    //   }
    // }

    // const return_result = { embedding: (await resp.json()).embedding as number[] };

    return {
      ollama: false as const,
      embeddings: responseBody.embeddings as number[][],
    };
  }


}