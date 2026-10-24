import { queryGemini } from '../lib/gemini'
import { searchWeb } from '../lib/tavily'

const TARGET = 'hoboken general contractor'

const KEYWORDS_TO_TEST = ['Basement Finishing', 'Home Additions', 'General Contracting']
const PROMPT_VARIANTS = [
  (kw: string, loc: string) => `Who are the best ${kw} companies in ${loc}? Give me specific local business names, not national chains. List 3-5 real companies.`,
  (kw: string, loc: string) => `best ${kw.toLowerCase()} in ${loc.toLowerCase()}`,
  (kw: string, loc: string) => `Who is the best ${kw.toLowerCase()} company in ${loc}?`,
  (kw: string, loc: string) => `List the top ${kw.toLowerCase()} contractors in ${loc}.`,
]

async function main() {
  const loc = 'Hoboken, NJ'
  for (const kw of KEYWORDS_TO_TEST) {
    console.log(`\n========== KEYWORD: ${kw} ==========`)
    for (let i = 0; i < PROMPT_VARIANTS.length; i++) {
      const prompt = PROMPT_VARIANTS[i](kw, loc)
      console.log(`\n--- Variant ${i + 1}: "${prompt}"`)
      try {
        const webContext = await searchWeb(prompt)
        const res = await queryGemini(prompt)
        const hit = res.toLowerCase().includes(TARGET)
        console.log(`  ${hit ? '✓ FOUND' : '✗ not found'} "${TARGET}" — response ${res.length} chars`)
        if (hit) {
          // Show the line with the match
          const lines = res.split('\n').filter((l) => /hoboken general/i.test(l))
          lines.forEach((l) => console.log(`    > ${l.trim().slice(0, 200)}`))
        } else {
          // Show first 250 chars to compare
          console.log(`    preview: ${res.slice(0, 250).replace(/\n/g, ' ')}`)
        }
      } catch (e) {
        console.log(`  ERROR:`, (e as Error).message)
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
