import { queryGemini } from '../lib/gemini'
import { analyzeResponse, aggregateCompetitors } from '../lib/parser'
import { getOpenAI } from '../lib/openai'

const TARGET = 'Hoboken General Contractor'
const CASES = [
  { keyword: 'General Contracting', location: 'Hoboken, NJ' },
  { keyword: 'Home Additions', location: 'Hoboken, NJ' },
  { keyword: 'Basement Finishing', location: 'Hoboken, NJ' },
]

function buildPrompt(kw: string, loc: string) {
  return `Who are the best ${kw} companies in ${loc}? Give me specific local business names, not national chains. List 3-5 real companies.`
}

async function main() {
  const openai = getOpenAI()
  const allCompetitors = []

  for (const { keyword, location } of CASES) {
    const prompt = buildPrompt(keyword, location)

    const [chatText, geminiText] = await Promise.all([
      openai.responses.create({ model: 'gpt-5.4-nano', input: prompt }).then(r => r.output_text),
      queryGemini(prompt),
    ])

    const [chatA, geminiA] = await Promise.all([
      analyzeResponse(chatText, TARGET),
      analyzeResponse(geminiText, TARGET),
    ])

    allCompetitors.push(chatA.competitors, geminiA.competitors)

    console.log(`\n[${keyword}]`)
    console.log(`  ChatGPT : ${chatA.mention.mentioned ? `✓ rank #${0} ` : '✗ not found'}`)
    console.log(`    above: ${chatA.competitors.filter(c=>c.above).map(c=>`${c.name}(#${c.rank})`).join(', ') || '—'}`)
    console.log(`    below: ${chatA.competitors.filter(c=>!c.above).map(c=>`${c.name}(#${c.rank})`).join(', ') || '—'}`)
    console.log(`  Gemini  : ${geminiA.mention.mentioned ? '✓ found' : '✗ not found'}`)
    console.log(`    above: ${geminiA.competitors.filter(c=>c.above).map(c=>`${c.name}(#${c.rank})`).join(', ') || '—'}`)
    console.log(`    below: ${geminiA.competitors.filter(c=>!c.above).map(c=>`${c.name}(#${c.rank})`).join(', ') || '—'}`)
  }

  const agg = aggregateCompetitors(allCompetitors)
  console.log('\n─── Aggregated Competitors ───')
  agg.slice(0, 8).forEach(c => {
    console.log(`  ${c.name.padEnd(35)} above: ${c.aboveCount}  below: ${c.belowCount}`)
  })
}

main().catch((e) => { console.error(e); process.exit(1) })
