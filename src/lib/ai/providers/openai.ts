/**
 * OpenAI Provider
 * Wrapper for the OpenAI SDK
 */

import OpenAI from 'openai'
import { AI_TIMEOUT_MS } from '@/lib/localization/constants'
import type { AIProvider, AIRequestParams, AIResponse } from './types'

export class OpenAIProvider implements AIProvider {
  private client: OpenAI

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set')
    }
    this.client = new OpenAI({ apiKey })
  }

  async call(params: AIRequestParams): Promise<AIResponse> {
    // Convert messages format: prepend system message
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: params.system },
      ...params.messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    const response = await this.client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens,
      messages,
    }, {
      timeout: AI_TIMEOUT_MS,
    })

    const text = response.choices[0]?.message?.content || ''
    const usage = response.usage

    return {
      text,
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
    }
  }
}
