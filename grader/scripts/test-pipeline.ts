import { queryGemini } from '../lib/gemini'
import { analyzeResponse } from '../lib/parser'
import { getOpenAI } from '../lib/openai'

const TARGET = 'Hoboken General Contractor'
const CASES = [
  { keyword: 'General Contracting', location: 'Hoboken, NJ' },
  { keyword: 'Basement Finishing', location: 'Hoboken, NJ' },
  { keyword: 'Home Additions', location: 'Hoboken, NJ' },
  { keyword: 'General Contracting', location: 'New Jersey' },
]

function buildPrompt(kw: string, loc: string) {
  return `Who are the best ${kw} companies in ${loc}? Give me specific local business names, not national chains. List 3-5 real companies.`
}

async function main() {
  const openai = getOpenAI()
  let chatHits = 0, geminiHits = 0, total = 0

  console.log('Model: gpt-5.4-nano (ChatGPT lane) | gemini-2.5-flash-lite (Gemini lane)\n')

  for (const { keyword, location } of CASES) {
    const prompt = buildPrompt(keyword, location)
    total++

    // ChatGPT lane: gpt-5.4-nano
    const chatRes = await openai.responses.create({ model: 'gpt-5.4-nano', input: prompt })
    const chatAnalysis = await analyzeResponse(chatRes.output_text, TARGET)
    if (chatAnalysis.mention.mentioned) chatHits++

    // Gemini lane: gemini-2.5-flash-lite
    const geminiText = await queryGemini(prompt)
    const geminiAnalysis = await analyzeResponse(geminiText, TARGET)
    if (geminiAnalysis.mention.mentioned) geminiHits++

    const chatCompetitors = chatAnalysis.competitors.slice(0, 3).join(', ') || '—'
    const gemCompetitors = geminiAnalysis.competitors.slice(0, 3).join(', ') || '—'

    console.log(`[${keyword} / ${location}]`)
    console.log(`  ChatGPT : ${chatAnalysis.mention.mentioned ? '✓ FOUND' : '✗ not found'}  competitors: ${chatCompetitors}`)
    console.log(`  Gemini  : ${geminiAnalysis.mention.mentioned ? '✓ FOUND' : '✗ not found'}  competitors: ${gemCompetitors}`)
  }

  console.log(`\n─────────────────────────────`)
  console.log(`ChatGPT hits: ${chatHits}/${total}`)
  console.log(`Gemini  hits: ${geminiHits}/${total}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
