import { searchWeb } from '../lib/tavily'

const SEARCHES = [
  'best general contracting in Hoboken, NJ',
  'best basement finishing in Hoboken, NJ',
  'best home additions in Hoboken, NJ',
  'best general contractor in Hoboken, NJ',
]

async function main() {
  for (const q of SEARCHES) {
    const ctx = await searchWeb(q)
    const hit = ctx.toLowerCase().includes('hoboken general contractor')
    console.log(`\n${hit ? '✓' : '✗'} "${q}"`)
    console.log(ctx.slice(0, 300).replace(/\n/g, ' '))
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
