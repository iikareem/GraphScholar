import { getAiConfig } from '../../config/ai.js';
import type { ChatCompletionResponse, EmbeddingResponse } from './types.js';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const { baseUrl, apiKey } = getAiConfig();

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`AI API error (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

/** Ask the LLM to return JSON text (OpenAI-compatible chat API) */
export async function createChatJson(systemPrompt: string, userPrompt: string): Promise<string> {
  const { conceptModel } = getAiConfig();

  const response = await postJson<ChatCompletionResponse>('/chat/completions', {
    model: conceptModel,
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('AI API returned an empty response');
  }

  return content;
}

/** Turn text into a vector (OpenAI-compatible embeddings API) */
export async function createEmbedding(text: string): Promise<number[]> {
  const { embeddingModel } = getAiConfig();

  const response = await postJson<EmbeddingResponse>('/embeddings', {
    model: embeddingModel,
    input: text,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error('AI API returned no embedding vector');
  }

  return embedding;
}
