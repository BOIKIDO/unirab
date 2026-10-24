import { searchWeb } from '../lib/tavily'
import { queryGemini } from '../lib/gemini'
import { getOpenAI } from '../lib/openai'

const TARGET = 'hoboken general contractor'

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

    const chatRes = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Analyze real-time web search results to answer questions about local businesses. Base your answer only on the provided search results.' },
        { role: 'user', content: `Search results:\n${webContext}\n\nQuestion: ${prompt}\n\nList the specific local businesses mentioned in these search results.` },
      ],
      max_tokens: 300,
      temperature: 0.3,
    })
    const chatText = chatRes.choices[0]?.message?.content ?? ''
    const chatHit = chatText.toLowerCase().includes(TARGET)
    if (chatHit) chatHits++

    const geminiText = await queryGemini(prompt)
    const geminiHit = geminiText.toLowerCase().includes(TARGET)
    if (geminiHit) geminiHits++

    console.log(`[${keyword}/${location}]  ChatGPT: ${chatHit ? '✓' : '✗'}  Gemini: ${geminiHit ? '✓' : '✗'}`)
  }

  console.log(`\nSummary: ChatGPT ${chatHits}/${total} hits, Gemini ${geminiHits}/${total} hits`)
}

main().catch((e) => { console.error(e); process.exit(1) })
