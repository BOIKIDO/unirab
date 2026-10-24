import { getOpenAI } from '../lib/openai'

const MODELS = [
  'gpt-4o-search-preview',
  'gpt-4o-search-preview-2025-03-11',
  'chatgpt-4o-latest',
  'gpt-4o-mini-search-preview-2025-03-11',
]

async function main() {
  const openai = getOpenAI()
  for (const model of MODELS) {
    try {
      const res = await openai.responses.create({
        model,
        tools: [{ type: 'web_search_preview' }],
        input: 'best general contractor in Hoboken NJ',
      })
      const hit = res.output_text.toLowerCase().includes('hoboken general contractor')
      console.log(`✓ ${model}: ${hit ? 'FOUND' : 'not found'} — ${res.output_text.slice(0, 120).replace(/\n/g, ' ')}`)
      break
    } catch (e: unknown) {
      const err = e as { status?: number; error?: { message?: string } }
      console.log(`✗ ${model}: ${err.status} — ${err.error?.message?.slice(0, 80)}`)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
