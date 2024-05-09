// That's right! No imports and no dependencies 🤯

import { LLM_API, DefaultChatCompletionContent, CreateChatCompletionRequest, CreateChatCompletionResponse, CreateEmbeddingResponse } from "./types";

// import { retryWithBackoff } from "./llm";



export class DummyModel implements LLM_API {

  private dummy_string: string = '';

  constructor(llm_model: string) {

    // dumpy function only to match the Interface.

    this.dummy_string = 'testing';

  }

  async chatCompletion(
    body: Omit<CreateChatCompletionRequest, 'model'> & {
      model?: CreateChatCompletionRequest['model'];
    }
  ) {

    // return a string with current time stamp as dummy content
    const content = 'Dummy content: ' + new Date().toISOString();
    return content;

  }

  async chatCompletionStream(
    body: Omit<CreateChatCompletionRequest, 'model'> & {
      model?: CreateChatCompletionRequest['model'];
    }
  ) {

    // build a string with current time stamp as dummy content
    const content = 'Dummy content: ' + new Date().toISOString();

    // build a ReadableStream<Uint8Array> from the string

    const encoder = new TextEncoder();
    const contentBytes = encoder.encode(content);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(contentBytes);
        controller.close();
      },
    });

    return new DefaultChatCompletionContent(stream, ['s']);

  }

  async fetchEmbeddingBatch(texts: string[]) {
    // return a dummy embedding
    const allembeddings = texts.map((text) => ({ embedding: new Array(1024).fill(0) }));
    return {
      ollama: false as const,
      embeddings: allembeddings.map(({ embedding }) => embedding),
      usage: texts.length,
    };
  }

  async fetchEmbedding(text: string) {
    const { embeddings, ...stats } = await this.fetchEmbeddingBatch([text]);
    return { embedding: embeddings[0], ...stats };
  }


}

