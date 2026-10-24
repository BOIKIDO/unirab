import { getOpenAI } from '../lib/openai'

const TARGET = 'hoboken general contractor'

async function main() {
  const openai = getOpenAI()

  console.log('--- Testing gpt-5.4-mini with web_search_preview ---')
  try {
    const res = await openai.responses.create({
      model: 'gpt-5.4-mini',
      tools: [{ type: 'web_search_preview' }],
      input: 'Who are the best general contractor companies in Hoboken, NJ? Give me specific real local business names.',
    })
    const hit = res.output_text.toLowerCase().includes(TARGET)
    console.log(`${hit ? '✓ FOUND' : '✗ not found'} "${TARGET}"`)
    console.log(`\nResponse:\n${res.output_text}`)
  } catch (e: unknown) {
    const err = e as { status?: number; error?: { message?: string } }
    console.log(`✗ FAILED: ${err.status} — ${err.error?.message}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
