/**
 * AI Cost Calculation Utilities
 * Calculate costs based on token usage and model pricing
 */

// Model pricing (dollars per million tokens)
// Sources: https://www.anthropic.com/pricing, https://openai.com/api/pricing/
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Claude 4 models
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-opus-4-20250514': { input: 15.00, output: 75.00 },

  // Claude 3.5 models
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20240620': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },

  // Claude 3 models
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },

  // OpenAI GPT-5 series
  'gpt-5.2': { input: 1.75, output: 14.00 },
  'gpt-5.1': { input: 1.25, output: 10.00 },
  'gpt-5': { input: 1.25, output: 10.00 },
  'gpt-5-mini': { input: 0.25, output: 2.00 },
  'gpt-5-nano': { input: 0.05, output: 0.40 },
  'gpt-5.2-pro': { input: 21.00, output: 168.00 },
  'gpt-5-pro': { input: 15.00, output: 120.00 },

  // OpenAI GPT-4.1 series
  'gpt-4.1': { input: 2.00, output: 8.00 },
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4.1-nano': { input: 0.10, output: 0.40 },

  // OpenAI GPT-4o models
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-2024-11-20': { input: 2.50, output: 10.00 },
  'gpt-4o-2024-08-06': { input: 2.50, output: 10.00 },
  'gpt-4o-2024-05-13': { input: 5.00, output: 15.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.60 },

  // OpenAI o-series reasoning models
  'o1': { input: 15.00, output: 60.00 },
  'o1-pro': { input: 150.00, output: 600.00 },
  'o1-mini': { input: 1.10, output: 4.40 },
  'o3': { input: 2.00, output: 8.00 },
  'o3-pro': { input: 20.00, output: 80.00 },
  'o3-mini': { input: 1.10, output: 4.40 },
  'o3-deep-research': { input: 10.00, output: 40.00 },
  'o4-mini': { input: 1.10, output: 4.40 },
  'o4-mini-deep-research': { input: 2.00, output: 8.00 },
}

// Default model (should match providers/index.ts)
const DEFAULT_MODEL = 'gpt-4o-mini'

// Fallback pricing if model not found in dictionary
const FALLBACK_PRICING = { input: 0.25, output: 1.25 }

/**
 * Get the current model from environment
 */
function getModel(): string {
  return process.env.AI_MODEL || DEFAULT_MODEL
}

/**
 * Get pricing for the current model
 */
function getModelPricing(): { input: number; output: number } {
  const model = getModel()
  return MODEL_PRICING[model] || FALLBACK_PRICING
}

/**
 * Get input token cost per million tokens
 */
export function getInputCostPerMillion(): number {
  return getModelPricing().input
}

/**
 * Get output token cost per million tokens
 */
export function getOutputCostPerMillion(): number {
  return getModelPricing().output
}

/**
 * Calculate cost in cents from token usage
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in cents (e.g., 0.5 = $0.005)
 */
export function calculateCostCents(inputTokens: number, outputTokens: number): number {
  const inputCostPerMillion = getInputCostPerMillion()
  const outputCostPerMillion = getOutputCostPerMillion()

  // Calculate cost in dollars
  const inputCostDollars = (inputTokens / 1_000_000) * inputCostPerMillion
  const outputCostDollars = (outputTokens / 1_000_000) * outputCostPerMillion

  // Convert to cents
  const totalCostCents = (inputCostDollars + outputCostDollars) * 100

  return totalCostCents
}

/**
 * Format cost in cents for display
 * Always shows 4 decimal places for consistency with micro-costs
 * @param costCents - Cost in cents
 * @returns Formatted string (e.g., "$0.0036")
 */
export function formatCostCents(costCents: number): string {
  const dollars = costCents / 100
  return `$${dollars.toFixed(4)}`
}

/**
 * Calculate cost in cents from token usage for a specific model
 * Used for recalculating costs when model pricing changes or backfilling
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @param model - The AI model name
 * @returns Cost in cents (e.g., 0.5 = $0.005)
 */
export function calculateCostCentsForModel(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const pricing = MODEL_PRICING[model] || FALLBACK_PRICING
  const inputCostDollars = (inputTokens / 1_000_000) * pricing.input
  const outputCostDollars = (outputTokens / 1_000_000) * pricing.output
  const totalCostCents = (inputCostDollars + outputCostDollars) * 100
  return totalCostCents
}
