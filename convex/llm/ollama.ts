// That's right! No imports and no dependencies 🤯

import { LLM_API, DefaultChatCompletionContent, CreateChatCompletionRequest, CreateChatCompletionResponse, CreateEmbeddingResponse } from "./types";

// import { retryWithBackoff } from "./llm";





export class OllamaModel implements LLM_API {

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

    assertApiKey();
    // OLLAMA_MODEL is legacy
    body.model =
      body.model ?? process.env.LLM_MODEL ?? process.env.OLLAMA_MODEL ?? LLM_CONFIG.chatModel;
    const stopWords = body.stop ? (typeof body.stop === 'string' ? [body.stop] : body.stop) : [];
    if (LLM_CONFIG.ollama) stopWords.push('<|eot_id|>');
    console.log(body);

    const result = await fetch(apiUrl('/v1/chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AuthHeaders(),
      },

      body: JSON.stringify(body),
    });
    if (!result.ok) {
      const error = await result.text();
      console.error({ error });
      if (result.status === 404 && LLM_CONFIG.ollama) {
        await tryPullOllama(body.model!, error);
      }
      throw {
        retry: result.status === 429 || result.status >= 500,
        error: new Error(`Chat completion failed with code ${result.status}: ${error}`),
      };
    }

    const json = (await result.json()) as CreateChatCompletionResponse;
    const content = json.choices[0].message?.content;
    if (content === undefined) {
      throw new Error('Unexpected result from OpenAI: ' + JSON.stringify(json));
    }
    console.log(content);
    return content;



  }

  async chatCompletionStream(
    body: Omit<CreateChatCompletionRequest, 'model'> & {
      model?: CreateChatCompletionRequest['model'];
    }
  ) {

    assertApiKey();
    // OLLAMA_MODEL is legacy
    body.model =
      body.model ?? process.env.LLM_MODEL ?? process.env.OLLAMA_MODEL ?? LLM_CONFIG.chatModel;
    const stopWords = body.stop ? (typeof body.stop === 'string' ? [body.stop] : body.stop) : [];
    if (LLM_CONFIG.ollama) stopWords.push('<|eot_id|>');
    console.log(body);

    const result = await fetch(apiUrl('/v1/chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AuthHeaders(),
      },

      body: JSON.stringify(body),
    });
    if (!result.ok) {
      const error = await result.text();
      console.error({ error });
      if (result.status === 404 && LLM_CONFIG.ollama) {
        await tryPullOllama(body.model!, error);
      }
      throw {
        retry: result.status === 429 || result.status >= 500,
        error: new Error(`Chat completion failed with code ${result.status}: ${error}`),
      };
    }

    return new DefaultChatCompletionContent(result.body!, stopWords);




  }

  async fetchEmbeddingBatch(texts: string[]) {
    if (LLM_CONFIG.ollama) {
      return {
        ollama: true as const,
        embeddings: await Promise.all(
          texts.map(async (t) => (await ollamaFetchEmbedding(t)).embedding),
        ),
      };
    }
    assertApiKey();

    const result = await fetch(apiUrl('/v1/embeddings'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AuthHeaders(),
      },

      body: JSON.stringify({
        model: LLM_CONFIG.embeddingModel,
        input: texts.map((text) => text.replace(/\n/g, ' ')),
      }),
    });
    if (!result.ok) {
      throw {
        retry: result.status === 429 || result.status >= 500,
        error: new Error(`Embedding failed with code ${result.status}: ${await result.text()}`),
      };
    }
    const json = (await result.json()) as CreateEmbeddingResponse;

    if (json.data.length !== texts.length) {
      console.error(json);
      throw new Error('Unexpected number of embeddings');
    }
    const allembeddings = json.data;
    allembeddings.sort((a, b) => a.index - b.index);

    console.log('-----------embeddings-----------');
    console.log('Embeddings:', allembeddings.length);

    console.log(allembeddings.map(({ embedding }) => embedding.slice(0, 5)));

    return {
      ollama: false as const,
      embeddings: allembeddings.map(({ embedding }) => embedding),
      usage: json.usage?.total_tokens,
    };
  }

  async fetchEmbedding(text: string) {
    console.log('fetchEmbedding=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=');
    const { embeddings, ...stats } = await this.fetchEmbeddingBatch([text]);
    return { embedding: embeddings[0], ...stats };
  }


}

export const LLM_CONFIG = {
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





async function tryPullOllama(model: string, error: string) {
  if (error.includes('try pulling')) {
    console.error('Embedding model not found, pulling from Ollama');
    const pullResp = await fetch(apiUrl('/api/pull'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: model }),
    });
    console.log('Pull response', await pullResp.text());
    throw { retry: true, error: `Dynamically pulled model. Original error: ${error}` };
  }
}


async function fetchModeration(content: string) {
  assertApiKey();

  const result = await fetch(apiUrl('/v1/moderations'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...AuthHeaders(),
    },

    body: JSON.stringify({
      input: content,
    }),
  });
  if (!result.ok) {
    throw {
      retry: result.status === 429 || result.status >= 500,
      error: new Error(`Embedding failed with code ${result.status}: ${await result.text()}`),
    };
  }
  return (await result.json()) as { results: { flagged: boolean }[] };

}

export function assertApiKey() {
  if (!LLM_CONFIG.ollama && !apiKey()) {
    throw new Error(
      '\n  Missing LLM_API_KEY in environment variables.\n\n' +
      (LLM_CONFIG.ollama ? 'just' : 'npx') +
      " convex env set LLM_API_KEY 'your-key'",
    );
  }
}



// Checks whether a suffix of s1 is a prefix of s2. For example,
// ('Hello', 'Kira:') -> false
// ('Hello Kira', 'Kira:') -> true
const suffixOverlapsPrefix = (s1: string, s2: string) => {
  for (let i = 1; i <= Math.min(s1.length, s2.length); i++) {
    const suffix = s1.substring(s1.length - i);
    const prefix = s2.substring(0, i);
    if (suffix === prefix) {
      return true;
    }
  }
  return false;
};



export async function ollamaFetchEmbedding(text: string) {

  const resp = await fetch(apiUrl('/api/embeddings'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: LLM_CONFIG.embeddingModel, prompt: text }),
  });
  if (resp.status === 404) {
    const error = await resp.text();
    await tryPullOllama(LLM_CONFIG.embeddingModel, error);
    throw new Error(`Failed to fetch embeddings: ${resp.status}`);
  }

  console.log('Embedding response', resp.status);

  const return_result = { embedding: (await resp.json()).embedding as number[] };

  // convert return_result to string and print it into console.log()
  console.log(JSON.stringify(return_result));

  return return_result;

  // return { embedding: (await resp.json()).embedding as number[] };


}
