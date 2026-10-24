import { searchWeb } from '../lib/tavily'
import { queryGemini } from '../lib/gemini'

const TARGET = 'hoboken general contractor'

async function main() {
  const query = 'Who are the best general contractor companies in Hoboken, NJ? Give me specific local business names, not national chains. List 3-5 real companies.'

  console.log(`\nQuery: "${query}"\n`)

  console.log('--- Step 1: Tavily web search ---')
  const webContext = await searchWeb(query)
  const hit1 = webContext.toLowerCase().includes(TARGET)
  console.log(`  ${hit1 ? '✓ FOUND' : '✗ not found'} "${TARGET}" in Tavily results`)
  console.log(`  Context length: ${webContext.length} chars`)
  console.log(`  Preview: ${webContext.slice(0, 400).replace(/\n/g, ' ')}\n`)

  console.log('--- Step 2: Gemini + Tavily context ---')
  const geminiResponse = await queryGemini(query)
  const hit2 = geminiResponse.toLowerCase().includes(TARGET)
  console.log(`  ${hit2 ? '✓ FOUND' : '✗ not found'} "${TARGET}" in Gemini response`)
  console.log(`  Response length: ${geminiResponse.length} chars`)
  console.log(`  Full response:\n${geminiResponse}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
