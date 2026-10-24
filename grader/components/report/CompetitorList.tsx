interface Competitor {
  id: string
  competitor_name: string
  mention_count: number
  above_count: number
  below_count: number
  verified?: boolean | null
}

interface Props {
  competitors: Competitor[]
  businessName: string
  businessMentions: number
}

type Row = {
  key: string
  name: string
  mentionCount: number
  aboveCount: number
  isTarget: boolean
  verified?: boolean | null
}

export default function CompetitorList({ competitors, businessName, businessMentions }: Props) {
  const targetRow: Row = {
    key: 'target',
    name: businessName,
    mentionCount: businessMentions,
    aboveCount: 0,
    isTarget: true,
    verified: true,
  }

  const competitorRows: Row[] = competitors.map((c) => ({
    key: c.id,
    name: c.competitor_name,
    mentionCount: c.mention_count,
    aboveCount: c.above_count,
    isTarget: false,
    verified: c.verified,
  }))

  // Only businesses confirmed real via Google Places (or still pending the
  // background check) appear in the report. Names AI invented are dropped
  // outright: ranking the user against fictional businesses would be made-up data.
  const realRows = competitorRows.filter((r) => r.verified !== false)
  const verifiedReal = realRows.filter((r) => r.verified === true).length
  const stillChecking = realRows.filter((r) => r.verified === null).length

  // Rank by mention count. On ties, the target wins — a competitor with the
  // SAME number of mentions isn't "above" you, so we don't display them as
  // such. Strictly-above competitors stay above; ties and below sit below.
  const sorted = [...realRows, targetRow].sort((a, b) => {
    if (b.mentionCount !== a.mentionCount) return b.mentionCount - a.mentionCount
    if (a.isTarget !== b.isTarget) return a.isTarget ? -1 : 1
    return b.aboveCount - a.aboveCount
  })

  // Always keep the top 10 PLUS the target row even if it ranks lower.
  const top10 = sorted.slice(0, 10)
  const includesTarget = top10.some((r) => r.isTarget)
  const display = includesTarget ? top10 : [...top10, targetRow]
  const targetPosition = sorted.findIndex((r) => r.isTarget) + 1

  const maxMentions = Math.max(...display.map((r) => r.mentionCount), 1)

  if (competitors.length === 0 && businessMentions === 0) {
    return (
      <div className="fade-up bg-white border border-black/[0.08] shadow-[var(--shadow-elevated)] rounded-2xl p-6 md:p-7 flex flex-col gap-4">
        <div>
          <p className="text-[#8a6a00] text-xs font-semibold tracking-[0.24em] uppercase mb-1">Competitor Analysis</p>
          <h2 className="text-[#102a2a] font-black text-xl tracking-[-0.02em]">Your AI search position</h2>
        </div>
        <p className="text-[#8a9694] text-sm text-center py-8">No competitors detected across any AI queries for this market.</p>
      </div>
    )
  }

  return (
    <div className="fade-up bg-white border border-black/[0.08] shadow-[var(--shadow-elevated)] rounded-2xl p-6 md:p-7 flex flex-col gap-4" style={{ animationDelay: '120ms' }}>
      <div>
        <p className="text-[#8a6a00] text-xs font-semibold tracking-[0.24em] uppercase mb-1">Competitor Analysis</p>
        <h2 className="text-[#102a2a] font-black text-xl tracking-[-0.02em]">AI search rankings</h2>
        <p className="text-[#5d6d6a] text-sm mt-1">
          {realRows.length > 0 ? (
            <>You rank <span className="font-bold text-[#102a2a]">#{targetPosition}</span> out of {sorted.length} real businesses AI mentions for these queries in your market.</>
          ) : (
            <>You&apos;re the only verified real business AI mentions for these queries in your market.</>
          )}
        </p>
      </div>

      {stillChecking > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-blue-600 text-xs">
            {stillChecking} competitor{stillChecking > 1 ? 's are' : ' is'} still being checked against Google Places. Refresh in a minute for final results.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {display.map((row, i) => {
          const sharePct = Math.round((row.mentionCount / maxMentions) * 100)
          const position = sorted.findIndex((r) => r.key === row.key) + 1

          const isAbove = !row.isTarget && row.mentionCount > targetRow.mentionCount
          const isTied = !row.isTarget && row.mentionCount === targetRow.mentionCount

          const rowBg = row.isTarget
            ? 'bg-[#ff735d]/[0.06]'
            : 'hover:bg-gray-50/70'
          const rowBorder = row.isTarget
            ? 'border-[#ff735d]/20'
            : 'border-transparent'
          const rankBg = row.isTarget
            ? 'bg-[#ff735d] text-black'
            : position === 1
              ? 'bg-[#ff735d]/15 text-[#8a6a00]'
              : 'bg-gray-100 text-[#8a9694]'
          const nameStyle = row.isTarget
            ? 'text-[#102a2a] font-bold'
            : 'text-[#344745] font-semibold'
          const barColor = row.isTarget
            ? '#ff735d'
            : isAbove ? '#E55353'
            : isTied ? '#E5A000'
            : '#D1D5DB'
          const metaColor = row.isTarget
            ? 'text-[#8a6a00] font-bold'
            : isAbove ? 'text-red-500 font-semibold'
            : isTied ? 'text-[#B45309] font-semibold'
            : 'text-[#8a9694]'

          const mentionLabel = `${row.mentionCount} mention${row.mentionCount !== 1 ? 's' : ''}`
          let suffix = ''
          if (isAbove && row.aboveCount > 0) suffix = ` · ${row.aboveCount}x ahead`
          else if (isTied) suffix = ' · tied'

          return (
            <div
              key={row.key}
              className={`fade-up flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 rounded-xl border transition-colors duration-200 ${rowBg} ${rowBorder}`}
              style={{ animationDelay: `${250 + i * 60}ms` }}
            >
              {/* Rank */}
              <span className={`w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${rankBg}`}>
                {position}
              </span>

              {/* Name + verification badge */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1 sm:flex-none sm:w-[200px] lg:w-[300px] sm:shrink-0">
                <span className={`text-[13px] truncate ${nameStyle}`}>
                  {row.name}
                </span>
                {row.isTarget && (
                  <span className="shrink-0 text-[13px] font-bold text-[#8a6a00]">(you)</span>
                )}
                {!row.isTarget && row.verified === true && (
                  <span className="shrink-0 text-[9px] font-bold bg-green-50 text-green-600 border border-green-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">verified</span>
                )}
              </div>

              {/* Bar + mentions — second line on mobile, same line from sm up */}
              <div className="flex items-center gap-3 w-full pl-9 sm:pl-0 sm:w-auto sm:flex-1 sm:min-w-0">
                <div className="flex-1 h-[5px] bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, sharePct)}%`,
                      background: barColor,
                      animation: `bar-grow 800ms cubic-bezier(0.22, 1, 0.36, 1) ${350 + i * 60}ms both`,
                    }}
                  />
                </div>
                <span className={`text-[11px] shrink-0 whitespace-nowrap text-right sm:w-[100px] lg:w-[140px] ${metaColor}`}>
                  {mentionLabel}{suffix}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-[#8a9694] leading-relaxed">
        Ranked by how many AI answers mentioned each business in this scan. <span className="text-red-500 font-bold">Red</span> = mentioned more than you · <span className="text-[#B45309] font-bold">amber</span> = tied with you.
        {verifiedReal > 0 && <span className="text-green-600 font-bold"> {verifiedReal} competitor{verifiedReal > 1 ? 's' : ''} verified real via Google Places.</span>}
      </p>
    </div>
  )
}
