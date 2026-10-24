import { searchWeb } from '../lib/tavily'
import { queryGemini } from '../lib/gemini'
import { analyzeResponse } from '../lib/parser'
import { getOpenAI } from '../lib/openai'

const CASES = [
  { keyword: 'General Contracting', location: 'Hoboken, NJ' },
  { keyword: 'Basement Finishing', location: 'Hoboken, NJ' },
  { keyword: 'Home Additions', location: 'Hoboken, NJ' },
]

function buildPrompt(kw: string, loc: string) {
  return `Who are the best ${kw} companies in ${loc}? Give me specific local business names, not national chains. List 3-5 real companies.`
}
function buildSearchQuery(kw: string, loc: string) {
  return `best ${kw.toLowerCase()} in ${loc}`
}

async function main() {
  const openai = getOpenAI()
  let chatHits = 0, geminiHits = 0, total = 0

  for (const { keyword, location } of CASES) {
    const prompt = buildPrompt(keyword, location)
    const searchQuery = buildSearchQuery(keyword, location)
    const webContext = await searchWeb(searchQuery)
    total++

    // ChatGPT lane: gpt-5.4-mini + Tavily context
    const chatRes = await openai.responses.create({
      model: 'gpt-5.4-mini',
      input: `You are analyzing real-time web search results. List EVERY business name that appears — do not filter.\n\nSearch results:\n${webContext}\n\nQuestion: ${prompt}\n\nList every local business name mentioned.`,
    })
    const chatText = `${chatRes.output_text}\n\n---\n${webContext}`
    const chatAnalysis = await analyzeResponse(chatText, 'Hoboken General Contractor')
    if (chatAnalysis.mention.mentioned) chatHits++

    // Gemini lane: Tavily context + Gemini
    const geminiLlm = await queryGemini(prompt)
    const geminiText = `${geminiLlm}\n\n---\n${webContext}`
    const geminiAnalysis = await analyzeResponse(geminiText, 'Hoboken General Contractor')
    if (geminiAnalysis.mention.mentioned) geminiHits++

    // Token check on ChatGPT lane
    console.log(`[${keyword}]  ChatGPT: ${chatAnalysis.mention.mentioned ? '✓' : '✗'}  Gemini: ${geminiAnalysis.mention.mentioned ? '✓' : '✗'}  (chat tokens: ${chatRes.usage?.total_tokens ?? '?'})`)
  }

  console.log(`\nSummary: ChatGPT ${chatHits}/${total}  Gemini ${geminiHits}/${total}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
