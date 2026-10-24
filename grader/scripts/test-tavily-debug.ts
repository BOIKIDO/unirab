import { searchWeb } from '../lib/tavily'

const QUERIES = [
  'Who are the best general contractor companies in Hoboken, NJ? Give me specific local business names, not national chains. List 3-5 real companies.',
  'best general contractor in Hoboken NJ',
]

async function main() {
  for (const q of QUERIES) {
    console.log(`\nQuery: "${q.slice(0, 70)}"`)
    const ctx = await searchWeb(q)
    const hit = ctx.toLowerCase().includes('hoboken general contractor')
    console.log(`Tavily hit: ${hit ? '✓' : '✗'}`)
    console.log(`Context:\n${ctx.slice(0, 600)}`)
    console.log('---')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
