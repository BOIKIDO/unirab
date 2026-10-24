import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { getOpenAI } from '../lib/openai'
import { queryGemini } from '../lib/gemini'
import { analyzeResponse } from '../lib/parser'
import { calculateScores, PlatformResult } from '../lib/scoring'

const TARGET = 'Roman Roofing'
const KEYWORDS = ['roofing contractor', 'roof replacement', 'roof repair']
const CITY = 'New York City, NY'
const STATE = 'New York'

function buildPrompt(kw: string, loc: string) {
  return `Who are the best ${kw} companies in ${loc}? Give me specific local business names, not national chains. List 3-5 real companies.`
}

async function runLane(platform: 'chatgpt' | 'gemini', kw: string, loc: string) {
  const prompt = buildPrompt(kw, loc)
  let text = ''
  if (platform === 'chatgpt') {
    const res = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.3,
    })
    text = res.choices[0]?.message?.content ?? ''
  } else {
    text = await queryGemini(prompt)
  }
  const analysis = await analyzeResponse(text, TARGET)
  return { text, analysis }
}

async function main() {
  const platformResults: Record<'chatgpt' | 'gemini', PlatformResult> = {
    chatgpt: { mentioned: false, mentionCount: 0, isFirstMention: false },
    gemini: { mentioned: false, mentionCount: 0, isFirstMention: false },
  }

  for (const platform of ['chatgpt', 'gemini'] as const) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`  ${platform.toUpperCase()}`)
    console.log(`${'─'.repeat(60)}`)

    for (const kw of KEYWORDS) {
      for (const loc of [CITY, STATE]) {
        const { text, analysis } = await runLane(platform, kw, loc)
        const { mention, competitors } = analysis

        if (mention.mentioned) {
          platformResults[platform].mentioned = true
          platformResults[platform].mentionCount += mention.mentionCount
          if (mention.isFirstMention) platformResults[platform].isFirstMention = true
        }

        console.log(`\n[${kw} / ${loc}]`)
        console.log(`  Target  : ${mention.mentioned ? `✓ FOUND (count: ${mention.mentionCount}, first: ${mention.isFirstMention})` : '✗ not found'}`)
        console.log(`  Competitors: ${competitors.slice(0, 3).map(c => c.name).join(', ') || '—'}`)
        console.log(`  Response: ${text.slice(0, 200).replace(/\n/g, ' ')}…`)
      }
    }
  }

  const scores = calculateScores({
    chatgpt: platformResults.chatgpt,
    gemini: platformResults.gemini,
    totalKeywords: KEYWORDS.length,
  })

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  SCORES`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`  ChatGPT : ${scores.chatgpt}/100`)
  console.log(`  Gemini  : ${scores.gemini}/100`)
  console.log(`  Overall : ${scores.overall}/100`)
}

main().catch((e) => { console.error(e); process.exit(1) })
