/**
 * Claude (Anthropic) Provider
 * Wrapper for the Anthropic SDK
 */

import Anthropic from '@anthropic-ai/sdk'
import { AI_TIMEOUT_MS } from '@/lib/localization/constants'
import type { AIProvider, AIRequestParams, AIResponse } from './types'

export class ClaudeProvider implements AIProvider {
  private client: Anthropic

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set')
    }
    this.client = new Anthropic({ apiKey })
  }

  async call(params: AIRequestParams): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: params.messages,
    }, {
      timeout: AI_TIMEOUT_MS,
    })

    const firstBlock = response.content[0]
    if (!firstBlock || firstBlock.type !== 'text') {
      throw new Error('Unexpected response format from Claude: expected text block')
    }

    return {
      text: firstBlock.text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }
  }
}
