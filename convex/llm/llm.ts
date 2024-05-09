import { LLM_API, ChatCompletionContent, CreateChatCompletionRequest, CreateChatCompletionResponse, CreateEmbeddingResponse } from "./types";
import { awsBedrock } from "./awsBedrock";
import { OllamaModel } from "./ollama";
import { DummyModel } from "./dummyLLM";

//import { CreateChatCompletionRequest, ChatCompletionContent, CreateChatCompletionResponse} from "./types";

export const LLM_EmbedingDimension = 1024;


export class LLM_Wrapper implements LLM_API {

  private LLM_Body: LLM_API;

  constructor(llm_model: string) {

    // check env setting to decide which implementation to use

    if (llm_model === 'aws') {


      this.LLM_Body = new awsBedrock(llm_model);
    } else if (llm_model === 'ollama') {

      var a = 'a'

      var new_llm_model = new OllamaModel(llm_model);

      this.LLM_Body = new_llm_model;
    }
    else if (llm_model === 'dummy') {
      this.LLM_Body = new DummyModel(llm_model);
    }
    else {
      this.LLM_Body = new awsBedrock(llm_model);
    }
  }

  async chatCompletion(
    body: Omit<CreateChatCompletionRequest, 'model'> & {
      model?: CreateChatCompletionRequest['model'];
    }
  ) {

    // OLLAMA_MODEL is legacy

    return this.LLM_Body.chatCompletion(body);
  }


  async chatCompletionStream(
    body: Omit<CreateChatCompletionRequest, 'model'> & {
      model?: CreateChatCompletionRequest['model'];
    }
  ) {

    return this.LLM_Body.chatCompletionStream(body);


  }

  async fetchEmbeddingBatch(texts: string[]) {

    return this.LLM_Body.fetchEmbeddingBatch(texts);

  }

  async fetchEmbedding(text: string) {

    return this.LLM_Body.fetchEmbedding(text);

  }


}




const LLM_CONFIG = {
  /* Ollama (local) config:
   */
  ollama: true,
  url: 'http://127.0.0.1:11434',
  chatModel: 'llama3' as const,
  embeddingModel: 'mxbai-embed-large',
  embeddingDimension: 1024,
  // embeddingModel: 'llama3',
  // embeddingDimension: 4096,

  /* Together.ai config:
  ollama: false,
  url: 'https://api.together.xyz',
  chatModel: 'meta-llama/Llama-3-8b-chat-hf',
  embeddingModel: 'togethercomputer/m2-bert-80M-8k-retrieval',
  embeddingDimension: 768,
   */

  /* OpenAI config:
  ollama: false,
  url: 'https://api.openai.com',
  chatModel: 'gpt-3.5-turbo-16k',
  embeddingModel: 'text-embedding-ada-002',
  embeddingDimension: 1536,
   */
};

function apiUrl(path: string) {
  // OPENAI_API_BASE and OLLAMA_HOST are legacy
  const host =
    process.env.LLM_API_URL ??
    process.env.OLLAMA_HOST ??
    process.env.OPENAI_API_BASE ??
    LLM_CONFIG.url;
  if (host.endsWith('/') && path.startsWith('/')) {
    return host + path.slice(1);
  } else if (!host.endsWith('/') && !path.startsWith('/')) {
    return host + '/' + path;
  } else {
    return host + path;
  }
}

function apiKey() {
  return process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
}

const AuthHeaders = (): Record<string, string> =>
  apiKey()
    ? {
      Authorization: 'Bearer ' + apiKey(),
    }
    : {};


// const llm_api = new LLM_Wrapper('ollama');
// const llm_api = new LLM_Wrapper('dummy');
const llm_api = new LLM_Wrapper('aws');

// Overload for non-streaming
export async function chatCompletion(
  body: Omit<CreateChatCompletionRequest, 'model'> & {
    model?: CreateChatCompletionRequest['model'];
  } & {
    stream?: false | null | undefined;
  },
): Promise<{ content: string; retries: number; ms: number }>;


// Overload for streaming
export async function chatCompletion(
  body: Omit<CreateChatCompletionRequest, 'model'> & {
    model?: CreateChatCompletionRequest['model'];
  } & {
    stream?: true;
  },
): Promise<{ content: ChatCompletionContent; retries: number; ms: number }>;


export async function chatCompletion(
  body: Omit<CreateChatCompletionRequest, 'model'> & {
    model?: CreateChatCompletionRequest['model'];
  },
) {

  // OLLAMA_MODEL is legacy

  console.log(body);
  const {
    result: content,
    retries,
    ms,
  } = await retryWithBackoff(async () => {

    if (body.stream) {
      const llm_api_result: ChatCompletionContent = await llm_api.chatCompletionStream(body);
      return llm_api_result;
    } else {
      const llm_api_result: string = await llm_api.chatCompletion(body);
      return llm_api_result;
    }
  });

  return {
    content,
    retries,
    ms,
  };
}



export async function fetchEmbeddingBatch(texts: string[]) {
  return llm_api.fetchEmbeddingBatch(texts);
}

export async function fetchEmbedding(text: string) {
  return llm_api.fetchEmbedding(text);
}




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





