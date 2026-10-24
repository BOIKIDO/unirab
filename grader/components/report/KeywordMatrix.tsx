import { Fragment } from 'react'

interface QueryResult {
  platform: string
  location_type: string
  keyword: string | null
  mentioned: boolean
  mention_count: number
}

interface Props {
  keywords: string[]
  queryResults: QueryResult[]
  city: string
  state: string
}

const PLATFORMS = [
  { key: 'chatgpt', label: 'ChatGPT' },
  { key: 'gemini', label: 'Gemini' },
] as const

const LOCATIONS = [
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
] as const

function FoundCheck() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-50 border border-green-200">
      <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </span>
  )
}

function NotFoundMark() {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6">
      <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  )
}

export default function KeywordMatrix({ keywords, queryResults, city, state }: Props) {
  // Each cell maps 1:1 to a real query the scan ran. No fallbacks, no inference —
  // a check appears only if THAT exact keyword × platform × location query
  // mentioned the business.
  const lookup: Record<string, Record<string, Record<string, boolean>>> = {}
  for (const r of queryResults) {
    if (!r.keyword) continue
    if (!lookup[r.keyword]) lookup[r.keyword] = {}
    if (!lookup[r.keyword][r.platform]) lookup[r.keyword][r.platform] = {}
    lookup[r.keyword][r.platform][r.location_type] = r.mentioned
  }

  const isMentioned = (kw: string, platform: string, location: string): boolean =>
    lookup[kw]?.[platform]?.[location] ?? false

  const locationLabel = (k: string) => (k === 'city' ? city : state)

  const serviceResults = queryResults.filter((r) => r.keyword && keywords.includes(r.keyword))
  const totalCells = keywords.length * PLATFORMS.length * LOCATIONS.length
  const foundCells = serviceResults.filter((r) => r.mentioned).length

  return (
    <section className="bg-white py-10 md:py-16 px-4 md:px-12 lg:px-20">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-black text-xl md:text-2xl text-[#102a2a] tracking-tight mb-1 md:mb-2">Keywords &amp; Locations</h2>
        <p className="text-[#5d6d6a] text-xs md:text-sm mb-5 md:mb-8">Where your business appears across AI platforms for each tracked keyword and location.</p>

        {/* Mobile: compact keyword cards */}
        <div className="md:hidden flex flex-col gap-2">
          {keywords.map((kw) => (
            <div key={kw} className="rounded-xl border border-black/[0.06] bg-white p-3">
              <p className="font-bold text-[#102a2a] text-[13px] capitalize mb-2">{kw}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {PLATFORMS.map(({ key: pKey, label: pLabel }) => (
                  <div key={pKey} className="rounded-lg bg-gray-50/70 border border-black/[0.06] p-2.5">
                    <p className="text-[9px] font-bold text-[#5d6d6a] uppercase tracking-[0.12em] mb-1.5">{pLabel}</p>
                    <div className="flex flex-col gap-1">
                      {LOCATIONS.map(({ key: lKey }) => (
                        <div key={lKey} className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-[#8a9694] truncate">{locationLabel(lKey)}</span>
                          {isMentioned(kw, pKey, lKey) ? <FoundCheck /> : <NotFoundMark />}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: full matrix table */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-black/[0.08] shadow-[var(--shadow-rest)] bg-white">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50/70">
                <th
                  rowSpan={2}
                  className="text-left align-bottom px-6 py-5 font-bold text-[#102a2a] w-56 border-b border-black/[0.08]"
                >
                  Keyword
                </th>
                {PLATFORMS.map(({ key, label }, idx) => (
                  <th
                    key={key}
                    colSpan={2}
                    className={`px-6 py-4 text-center font-bold text-[#102a2a] text-base ${
                      idx > 0 ? 'border-l border-black/[0.08]' : ''
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
              <tr className="bg-gray-50/70 border-b border-black/[0.08]">
                {PLATFORMS.map(({ key: pKey }, pIdx) => (
                  <Fragment key={pKey}>
                    {LOCATIONS.map(({ key: lKey, label: lLabel }, lIdx) => (
                      <th
                        key={`${pKey}-${lKey}`}
                        className={`px-4 pb-5 pt-1 text-center ${
                          pIdx > 0 && lIdx === 0 ? 'border-l border-black/[0.08]' : ''
                        }`}
                      >
                        <div className="inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg border border-black/[0.08] bg-white min-w-[88px]">
                          <span className="text-[10px] font-bold text-[#5d6d6a] uppercase tracking-[0.12em] leading-none">
                            {locationLabel(lKey)}
                          </span>
                          <span className="text-[10px] text-[#8a9694] lowercase tracking-wide leading-none">
                            ({lLabel})
                          </span>
                        </div>
                      </th>
                    ))}
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {keywords.map((kw, i) => (
                <tr
                  key={kw}
                  className={`border-b border-black/[0.06] last:border-b-0 ${
                    i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                  }`}
                >
                  <td className="px-6 py-4 font-medium text-[#344745] capitalize align-middle">
                    {kw}
                  </td>
                  {PLATFORMS.map(({ key: pKey }, pIdx) => (
                    <Fragment key={pKey}>
                      {LOCATIONS.map(({ key: lKey }, lIdx) => (
                        <td
                          key={`${pKey}-${lKey}`}
                          className={`px-4 py-4 text-center align-middle ${
                            pIdx > 0 && lIdx === 0 ? 'border-l border-black/[0.08]' : ''
                          }`}
                        >
                          {isMentioned(kw, pKey, lKey) ? <FoundCheck /> : <NotFoundMark />}
                        </td>
                      ))}
                    </Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {foundCells === 0 ? (
          <p className="text-[#102a2a] font-semibold text-sm mt-4 text-center">
            Your business was not found in any AI search result for these keywords.
            This means {city} homeowners searching for these services are being sent to your competitors.
          </p>
        ) : (
          <p className="text-[#5d6d6a] text-xs mt-4 text-center">
            Your business appeared in {foundCells} of {totalCells} keyword-location-platform searches run in this scan.
          </p>
        )}
      </div>
    </section>
  )
}
