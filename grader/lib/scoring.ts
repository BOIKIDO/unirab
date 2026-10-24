export interface PlatformResult {
  mentioned: boolean
  mentionCount: number
  isFirstMention: boolean // business appears before any competitor
}

export interface ScoreInput {
  chatgpt: PlatformResult
  gemini: PlatformResult
  totalKeywords: number
}

export function scoreGrade(score: number): { label: string; color: string } {
  if (score <= 20) return { label: 'Dead in the Water', color: '#EF4444' }
  if (score <= 40) return { label: 'Bleeding Out', color: '#EF4444' }
  if (score <= 60) return { label: 'Treading Water', color: '#F97316' }
  if (score <= 75) return { label: 'In the Game', color: '#F59E0B' }
  if (score <= 90) return { label: 'Market Contender', color: '#22C55E' }
  return { label: 'Category King', color: '#22C55E' }
}

function platformScore(result: PlatformResult, totalKeywords: number): number {
  if (totalKeywords === 0) return 0
  const base = (result.mentionCount / (totalKeywords * 2)) * 80 // *2 for city+state calls
  const bonus = result.isFirstMention ? 10 : result.mentionCount > 0 ? 5 : 0
  return Math.min(100, Math.round(base + bonus))
}

export function calculateScores(input: ScoreInput): {
  chatgpt: number
  gemini: number
  overall: number
} {
  const chatgpt = platformScore(input.chatgpt, input.totalKeywords)
  const gemini = platformScore(input.gemini, input.totalKeywords)
  const overall = Math.round(chatgpt * 0.6 + gemini * 0.4)
  return { chatgpt, gemini, overall }
}
