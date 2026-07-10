/** Structured concept output from the LLM */
export interface ExtractedConcepts {
  introduces: string[];
  uses: string[];
  related: [string, string][];
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
}

export interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}
