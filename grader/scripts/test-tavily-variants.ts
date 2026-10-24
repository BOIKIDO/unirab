import { searchWeb } from '../lib/tavily'

const TARGET = 'hoboken general contractor'

const QUERIES = [
  'best general contractor in Hoboken NJ',
  'best general contracting in Hoboken NJ',
  'top general contractors Hoboken New Jersey',
  'general contractor Hoboken NJ reviews',
  'Who is hoboken general contractor',
  'hoboken general contractor NJ',
]

async function main() {
  for (const q of QUERIES) {
    try {
      const context = await searchWeb(q)
      const hit = context.toLowerCase().includes(TARGET)
      console.log(`${hit ? '✓' : '✗'} "${q}"`)
      if (hit) {
        const lines = context.split('\n').filter(l => /hoboken general contractor/i.test(l))
        lines.forEach(l => console.log(`   > ${l.trim().slice(0, 200)}`))
      } else {
        console.log(`   preview: ${context.slice(0, 180).replace(/\n/g, ' ')}`)
      }
    } catch (e) {
      console.log(`  ERROR: ${(e as Error).message}`)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
