

import { LLM_API } from "./types";
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




export class awsBedrock implements LLM_API {

  private client: BedrockRuntimeClient = new BedrockRuntimeClient({ region: "us-west-2" });
  private model_config: ModelConfig = {
    model: "claude-3-sonnet",
    top_p: 0.9,
    temperature: 0.9,
    max_tokens: 100,
    model_id: "anthropic.claude-3-sonnet-20240229-v1:0",
    anthropic_version: "bedrock-2023-05-31",
  };






  constructor(llm_model: string) {



  }

  convertMessagePayload(
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

  async chatCompletion(
    body: Omit<CreateChatCompletionRequest, 'model'> & {
      model?: CreateChatCompletionRequest['model'];
    }
  ) {

    // OLLAMA_MODEL is legacy

    console.log(body);

    return 'You are helpful';
  }


  async chatCompletionStream(
    body: Omit<CreateChatCompletionRequest, 'model'> & {
      model?: CreateChatCompletionRequest['model'];
    }
  ) {

    console.log('------------------------------------------');
    console.log(body);
    // build a string with current time stamp as dummy content


    const new_message_payload = this.convertMessagePayload(body.messages, this.model_config);

    console.log(new_message_payload);

    const response = await this.invokeModelWithStream(new_message_payload, this.model_config.model_id);

    if (response.body) {
      // console.log('streaming response', response.body);

      return new BedrockChatCompletionContent(response.body);


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

    return {
      ollama: true as const,
      embeddings: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]]
    };
  }


}