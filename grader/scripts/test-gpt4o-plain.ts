import { getOpenAI } from '../lib/openai'

const TARGET = 'hoboken general contractor'

const QUERIES = [
  'Who are the best general contractor companies in Hoboken, NJ? List 3-5 real local companies.',
  'best general contractor in Hoboken NJ',
  'top home remodeling contractors in Hoboken NJ',
  'best basement finishing company in Hoboken NJ',
]

async function main() {
  const openai = getOpenAI()
  for (const q of QUERIES) {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: q }],
      max_tokens: 300,
      temperature: 0.7,
    })
    const text = res.choices[0]?.message?.content ?? ''
    const hit = text.toLowerCase().includes(TARGET)
    console.log(`${hit ? '✓' : '✗'} "${q}"`)
    if (hit) {
      const lines = text.split('\n').filter(l => /hoboken general contractor/i.test(l))
      lines.forEach(l => console.log(`   > ${l.trim().slice(0, 150)}`))
    } else {
      console.log(`   ${text.slice(0, 150).replace(/\n/g, ' ')}`)
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
