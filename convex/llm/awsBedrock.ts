

import { LLM_API } from "./types";
import { CreateChatCompletionRequest, ChatCompletionContent, CreateChatCompletionResponse } from "./types";


// Retry after this much time, based on the retry number.
const RETRY_BACKOFF = [1000, 10_000, 20_000]; // In ms
const RETRY_JITTER = 100; // In ms
type RetryError = { retry: boolean; error: any };

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
): Promise<{ retries: number; result: T; ms: number }> {
  let i = 0;
  for (; i <= RETRY_BACKOFF.length; i++) {
    try {
      const start = Date.now();
      const result = await fn();
      const ms = Date.now() - start;
      return { result, retries: i, ms };
    } catch (e) {
      const retryError = e as RetryError;
      if (i < RETRY_BACKOFF.length) {
        if (retryError.retry) {
          console.log(
            `Attempt ${i + 1} failed, waiting ${RETRY_BACKOFF[i]}ms to retry...`,
            Date.now(),
          );
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_BACKOFF[i] + RETRY_JITTER * Math.random()),
          );
          continue;
        }
      }
      if (retryError.error) throw retryError.error;
      else throw e;
    }
  }
  throw new Error('Unreachable');
}



export class awsBedrock implements LLM_API {



  async chatCompletion(
    body: Omit<CreateChatCompletionRequest, 'model'> & {
      model?: CreateChatCompletionRequest['model'];
    }
  ) {

    // OLLAMA_MODEL is legacy

    return 'You are helpful';
  }


  async chatCompletionStream(
    body: Omit<CreateChatCompletionRequest, 'model'> & {
      model?: CreateChatCompletionRequest['model'];
    }
  ) {


    const result = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify(body),
    });

    const dummy_content = new ChatCompletionContent(result.body!, ['s']);

    return dummy_content;




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