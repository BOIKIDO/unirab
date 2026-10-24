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
    total++

    const webContext = await searchWeb(searchQuery)

    // ChatGPT lane: LLM response + raw context fallback
    const chatRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Analyze real-time web search results. List EVERY business name that appears — do not filter or rank.' },
        { role: 'user', content: `Search results:\n${webContext}\n\nQuestion: ${prompt}\n\nList every local business name mentioned.` },
      ],
      max_tokens: 400, temperature: 0.1,
    })
    const chatText = (chatRes.choices[0]?.message?.content ?? '') + '\n\n---\n' + webContext
    const chatAnalysis = await analyzeResponse(chatText, 'Hoboken General Contractor')
    if (chatAnalysis.mention.mentioned) chatHits++

    // Gemini lane: LLM response + raw context fallback
    const geminiLlm = await queryGemini(prompt)
    const geminiText = geminiLlm + '\n\n---\n' + webContext
    const geminiAnalysis = await analyzeResponse(geminiText, 'Hoboken General Contractor')
    if (geminiAnalysis.mention.mentioned) geminiHits++

    console.log(`[${keyword}]  ChatGPT: ${chatAnalysis.mention.mentioned ? '✓' : '✗'}  Gemini: ${geminiAnalysis.mention.mentioned ? '✓' : '✗'}`)
  }

  console.log(`\nSummary: ChatGPT ${chatHits}/${total}  Gemini ${geminiHits}/${total}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
