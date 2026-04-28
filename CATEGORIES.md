# Nvidia Partnership Ontology

This document defines what counts as a partnership for this tracker, how to categorize it, and — importantly — what to exclude. Read this every extraction session. When the rules feel wrong, update the rules; don't make ad-hoc exceptions.

## What counts as a partnership

A partnership is a **named, public, ongoing relationship** between Nvidia and another entity that involves one or more of: shared technology development, supply, deployment, integration, or strategic alignment.

It must be:
- **Named publicly** by Nvidia, the partner, or both (press release, SEC filing, keynote, executive statement)
- **Ongoing or forward-looking** — not a one-time transaction
- **Substantive** — has a stated purpose beyond marketing

## What does NOT count (be ruthless here)

- **Customers buying GPUs.** Meta, Microsoft, etc. purchasing H100s or B200s is procurement, not partnership. Only count when the relationship goes beyond purchase (co-engineering, custom silicon, exclusive deployment).
- **Resellers and distributors.** SHI, CDW, etc. — commercial channel relationships are not what we're tracking.
- **Developers using CUDA.** Every AI lab "uses Nvidia." That's the market, not a partnership.
- **Conference sponsorships and event appearances.** GTC speakers are not partners by virtue of speaking.
- **Rumored or unconfirmed deals.** If the only source is "people familiar with the matter," wait for confirmation.
- **Pure investments without operational tie.** Nvidia's VC arm (NVentures) makes many investments. Include only if there's a stated technology or product collaboration alongside the check.
- **Historical partnerships that have visibly ended.** Mark these dormant rather than deleting, but don't add new dormant entries.

## Categories

Each relationship gets exactly one primary category. If it genuinely spans two, pick the one closest to the *stated purpose* of the announcement, and note the secondary in the `notes` field.

### 1. `silicon` — Hardware and manufacturing
The physical chip supply chain. Fabrication, memory, packaging, assembly.

Examples: TSMC (fab), SK Hynix / Micron / Samsung (HBM memory), Foxconn / Wistron (server assembly), ASE (advanced packaging).

### 2. `interconnect` — Networking and fabric
Technologies that connect chips, systems, and racks. NVLink, NVLink Fusion, Spectrum-X, Quantum InfiniBand, and partner silicon that plugs into these fabrics.

Examples: MediaTek and Marvell (NVLink Fusion custom silicon), Astera Labs, partners building NVLink-compatible CPUs or accelerators.

### 3. `cloud` — Infrastructure deployment
Companies deploying Nvidia hardware as cloud or colocation infrastructure at scale, with a named partnership beyond simple procurement.

Examples: CoreWeave, Lambda, Nebius, Crusoe. Hyperscalers (AWS, Azure, GCP, Oracle) only when there's a named joint program (e.g., DGX Cloud, specific co-engineered offerings) — not just "they sell H100 instances."

### 4. `software` — Frameworks, models, and platforms
Software companies and AI labs with named technical collaboration: optimization work, co-developed libraries, exclusive integrations.

Examples: model labs with announced co-engineering (not just "trained on Nvidia"), ISVs integrating CUDA-X libraries, framework maintainers with Nvidia engineering involvement.

Hard to get right — be conservative. Default to excluding unless the announcement names specific joint engineering.

### 5. `vertical` — Industry deployment partners
Companies in non-tech verticals deploying Nvidia platforms for a specific industry use case, named as partners.

Subtypes worth tracking in `notes`: `auto`, `robotics`, `healthcare`, `industrial`, `telecom`, `sovereign-ai`.

Examples: Mercedes-Benz (auto), Foxconn (robotics, distinct from its silicon assembly role), Schneider Electric (data center / industrial), various sovereign AI deals with national entities.

### 6. `investment` — Strategic investments with operational substance
Nvidia equity investments where there's *also* a named technology or commercial collaboration. Pure financial bets go in exclusions.

Examples: investments accompanied by supply agreements, co-development announcements, or board-level technology commitments.

## Required fields per relationship

```json
{
  "partner": "TSMC",
  "category": "silicon",
  "purpose": "Manufactures Nvidia's leading-edge GPUs on N4 and N3 process nodes",
  "evidence_quote": "Short, attributable phrase from the source. Under 15 words.",
  "evidence_url": "https://...",
  "first_announced": "2020-XX-XX or best-effort",
  "last_confirmed": "2026-04-XX",
  "status": "active | dormant | ended",
  "confidence": "high | medium | low",
  "notes": "Secondary category, caveats, or context"
}
```

## Confidence rubric

- **high** — Confirmed by Nvidia in an official channel (press release, SEC filing, keynote) AND the partner has not denied it.
- **medium** — Confirmed by one side only, or reported by tier-1 trade press citing on-record sources.
- **low** — Reported but not officially confirmed; include only if the relationship is widely treated as fact in the industry. Flag for re-review.

If you can't reach at least medium, don't add the entry. Put it in `pending.json` with a re-review date.

## Status lifecycle

- **active** — Confirmed within the last 12 months, no contradicting signals.
- **dormant** — No public confirmation in 12+ months, but no announced end.
- **ended** — Publicly terminated, or replaced by a new arrangement.

Dormant entries stay in the graph but render dimmer. Ended entries are hidden by default.

## Edge cases and judgment calls

- **Multi-party announcements** (Nvidia + 5 auto OEMs at once): create one entry per partner, same evidence URL.
- **Subsidiaries vs. parents**: track at the level the announcement uses. "Mercedes-Benz" not "Daimler AG" unless the parent is what's named.
- **Renamed or merged partners**: keep the historical entry, add a `successor` field pointing to the new entity.
- **Nvidia acquiring a partner**: convert to acquisition, remove from partnership graph (different relationship type).

## Update discipline

- Every extraction session, re-confirm at least 5 random `active` entries. If the most recent evidence is over 12 months old, downgrade to `dormant`.
- Never edit `first_announced` after initial entry except to correct an error.
- `last_confirmed` updates every time a new piece of evidence is added.
