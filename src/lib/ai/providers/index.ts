/**
 * AI Provider Factory
 * Selects the appropriate provider based on model name
 */

import type { AIProvider } from './types'
import { ClaudeProvider } from './claude'
import { OpenAIProvider } from './openai'

// Default model if AI_MODEL env var not set
const DEFAULT_MODEL = 'gpt-4o-mini'

/**
 * Check if a model name indicates OpenAI
 */
export function isOpenAIModel(model: string): boolean {
  return model.startsWith('gpt-') ||
         model.startsWith('o1-') ||
         model.startsWith('o3-') ||
         model.startsWith('o4-') ||
         model === 'o1' ||
         model === 'o3'
}

/**
 * Check if a model name indicates Claude/Anthropic
 */
export function isClaudeModel(model: string): boolean {
  return model.startsWith('claude-')
}

/**
 * Get the current model from environment
 */
export function getModel(): string {
  return process.env.AI_MODEL || DEFAULT_MODEL
}

// Cached provider instance
let cachedProvider: AIProvider | null = null
let cachedProviderModel: string | null = null

/**
 * Get the appropriate AI provider for the current model
 */
export function getProvider(): AIProvider {
  const model = getModel()

  // Return cached provider if model hasn't changed
  if (cachedProvider && cachedProviderModel === model) {
    return cachedProvider
  }

  if (isOpenAIModel(model)) {
    cachedProvider = new OpenAIProvider()
  } else {
    // Default to Claude for claude-* models or unknown models
    cachedProvider = new ClaudeProvider()
  }

  cachedProviderModel = model
  return cachedProvider
}

// Re-export types
export type { AIProvider, AIRequestParams, AIResponse } from './types'
