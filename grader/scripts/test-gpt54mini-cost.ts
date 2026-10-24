import { getOpenAI } from '../lib/openai'

async function main() {
  const openai = getOpenAI()

  const res = await openai.responses.create({
    model: 'gpt-5.4-mini',
    tools: [{ type: 'web_search_preview' }],
    input: 'Who are the best general contractor companies in Hoboken, NJ? Give me specific real local business names.',
  })

  console.log('Usage:', JSON.stringify(res.usage, null, 2))
  console.log('\nOutput items:')
  for (const item of res.output) {
    console.log(`  type: ${item.type}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
