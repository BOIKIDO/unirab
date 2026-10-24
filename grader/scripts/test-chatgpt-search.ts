import { getOpenAI } from '../lib/openai'

const TARGET = 'hoboken general contractor'

async function main() {
  const prompt = 'Who are the best general contractor companies in Hoboken, NJ? Give me specific local business names, not national chains. List 3-5 real companies.'
  console.log(`\nQuery: "${prompt}"\n`)

  const openai = getOpenAI()
  const res = await openai.responses.create({
    model: 'gpt-4o-mini-search-preview',
    tools: [{ type: 'web_search_preview' }],
    input: prompt,
  })

  const text = res.output_text
  const hit = text.toLowerCase().includes(TARGET)
  console.log(`${hit ? '✓ FOUND' : '✗ not found'} "${TARGET}"`)
  console.log(`\nFull response:\n${text}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
