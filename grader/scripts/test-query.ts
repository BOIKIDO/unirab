import { getOpenAI } from '../lib/openai'
import { queryGemini } from '../lib/gemini'

const TARGET = 'Hoboken General Contractor'
const PROMPTS = [
  'best general contractor in hoboken nj',
  'Who are the best general contractor companies in Hoboken, NJ? Give me specific local business names, not national chains. List 3-5 real companies.',
  'Who is the best general contractor in Hoboken, NJ?',
]

async function runChatGPT(prompt: string): Promise<string> {
  const openai = getOpenAI()
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
    temperature: 0.7,
  })
  return res.choices[0]?.message?.content ?? ''
}

async function main() {
  for (const prompt of PROMPTS) {
    console.log('\n========================================')
    console.log('PROMPT:', prompt)
    console.log('========================================')

    const [cg, gm] = await Promise.all([
      runChatGPT(prompt).catch((e) => `ERROR: ${e.message}`),
      queryGemini(prompt).catch((e) => `ERROR: ${e.message}`),
    ])

    const cgHit = cg.toLowerCase().includes(TARGET.toLowerCase())
    const gmHit = gm.toLowerCase().includes(TARGET.toLowerCase())

    console.log(`\n[ChatGPT gpt-4o] — contains "${TARGET}": ${cgHit ? 'YES ✓' : 'NO ✗'}`)
    console.log(cg.slice(0, 600))

    console.log(`\n[Gemini 2.5-flash] — contains "${TARGET}": ${gmHit ? 'YES ✓' : 'NO ✗'}`)
    console.log(gm.slice(0, 600))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
