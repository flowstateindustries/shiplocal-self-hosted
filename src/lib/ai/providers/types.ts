/**
 * AI Provider Types
 * Common interfaces for multi-provider support
 */

export interface AIResponse {
  text: string
  inputTokens: number
  outputTokens: number
}

export interface AIRequestParams {
  model: string
  maxTokens: number
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface AIProvider {
  call(params: AIRequestParams): Promise<AIResponse>
}
