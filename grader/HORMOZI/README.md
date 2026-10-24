# Pound Cake — Agent Knowledge Index

## Overview
8 specialized agents extracted from Alex Hormozi's complete $100M playbook series.
7 PDFs (221 pages) + $100M Money Models audiobook transcript (249KB).
Every page scanned. Every framework extracted. Zero skipped.

## Agent Catalog

| # | Agent | Source Book | Pages | Domain |
|---|---|---|---|---|
| 01 | Branding Agent | $100M Branding Playbook | 36 | Brand strategy, positioning, audience building |
| 02 | Fast Cash Agent | $100M Fast Cash Playbook | 29 | Limited-time offers, quarterly cash plays, warm audience monetization |
| 03 | Hooks & Copywriting Agent | $100M Hooks Playbook | 26 | Attention hooks, copywriting, 70-20-10 content system |
| 04 | Lead Nurture & Sales Agent | $100M Lead Nurture Playbook | 45 | 4 pillars: Availability, Speed, Personalization, Volume |
| 05 | LTV & Monetization Agent | $100M Lifetime Value Playbook + Money Models | 27+ | The Crazy 8, churn math, money model framework |
| 06 | Marketing Machine Agent | $100M Marketing Machine | 30 | Customer-generated ads, testimonials, 9-node system |
| 07 | Pricing Agent | $100M Price Raise Playbook | 28 | RAISE framework, price testing, virtuous vs vicious cycle |
| 08 | Money Model Strategist | $100M Money Models (script.txt) | Full transcript | 4 offer types, 15+ offer frameworks, 3-stage money model building |

## Agent Activation Map

| When user needs... | Activate Agent(s) |
|---|---|
| Brand strategy, positioning, audience definition | 01 — Branding |
| Quick revenue injection, limited-time promos | 02 — Fast Cash |
| Ad headlines, video hooks, email subject lines | 03 — Hooks & Copywriting |
| Sales process, show rates, lead follow-up | 04 — Lead Nurture |
| Customer value optimization, upsells, churn | 05 — LTV & Monetization |
| Testimonial systems, customer proof, ads without founder | 06 — Marketing Machine |
| Pricing strategy, price increase letters | 07 — Pricing |
| Full offer sequence design, business model architecture | 08 — Money Model Strategist |

## Phase 2 — ✅ COMPLETE
All 8 agent personas created as full system prompts in `personas/`:
- Each persona has: distinct voice, activation triggers, core frameworks, scripts, templates, visual references, response patterns
- Orchestrator (`ORCHESTRATOR.md`) built with: routing table, multi-agent chaining logic, master activation prompt

## File Structure
```
agents/
├── README.md                          ← This index
├── ORCHESTRATOR.md                    ← Master routing system + activation prompt
├── 01-branding-agent.md               ← Knowledge base (raw extraction)
├── 02-fast-cash-agent.md
├── 03-hooks-copywriting-agent.md
├── 04-lead-nurture-agent.md
├── 05-ltv-monetization-agent.md
├── 06-marketing-machine-agent.md
├── 07-pricing-agent.md
├── 08-money-model-strategist.md
└── personas/
    ├── 01-brand-strategist.md         ← Agent persona (system prompt ready)
    ├── 02-cash-engineer.md
    ├── 03-hook-scientist.md
    ├── 04-lead-closer.md
    ├── 05-profit-maximizer.md
    ├── 06-proof-engineer.md
    ├── 07-price-architect.md
    └── 08-money-model-architect.md
```
