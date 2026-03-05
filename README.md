# Preset Analyzer — SillyTavern Extension

> Analyze your SillyTavern prompt presets for inefficiencies, redundancies,
> contradictions, and bloat. Designed for large presets with thousands of
> tokens.

## Installation

1. Open SillyTavern and navigate to the **Extensions** panel.
2. Click **Install Extension**.
3. Paste the following URL:

```
https://github.com/Cheesedozer/ST-Preset-Analyzer
```

4. Click **Save** and reload SillyTavern.

## What It Does

Preset Analyzer examines your prompt presets through two independent
analysis modes:

### Cross-Prompt Analysis
Scans all **currently active** prompt entries in your loaded preset
as a group and identifies:

- **Direct Contradictions** — Two prompts giving the model opposing
  instructions.
- **Semantic Redundancy** — The same instruction repeated across
  multiple prompts. Flags whether the repetition appears intentional
  (strategic reinforcement) or accidental, with a confidence score.
- **Graduated Contradictions** — Prompts pulling different degrees of
  the same axis (e.g., "be concise" vs. "write rich descriptions").
  Framed as tension rather than error, since this is sometimes by
  design.

Results include the specific quoted passages from each involved prompt
so you can see exactly what was flagged.

An optional **Deep Dive** button on any finding triggers a targeted
follow-up analysis for more detailed recommendations on that specific
issue.

### Individual Prompt Analysis
Analyzes a single prompt entry in isolation for internal quality issues:

- **Internal Self-Contradiction** — The prompt contradicts itself.
- **Internal Verbosity** — Uses more tokens than needed to convey its
  instructions.
- **Vague / Unactionable Instructions** — Directives too abstract for
  the model to follow.
- **Dead Weight** — Instructions the model will likely ignore.
- **Structural Disorganization** — Poor internal ordering or grouping.

Each issue includes the flagged passage, an explanation of why it is a
problem, and a **suggested rewrite** for that passage.

A **full rewrite** of the entire prompt is also provided, shown as a
**diff view** (red for removed text, green for added text) so you can
see exactly what changed. The model lists all **assumptions** it made
during the rewrite so you can make an informed accept/reject decision.

Token savings estimates are shown for both per-issue and full rewrites.

## How to Use

1. Load a preset in SillyTavern.
2. Open the **Extensions** panel and expand **Preset Analyzer**.
3. Toggle which analysis phases you want enabled (both are on by
   default).
4. Click **Run Cross-Prompt Analysis** to scan all active entries, or
   **Run Individual Analysis** and select a specific prompt (or "All").
5. Review results grouped by issue type. Expand any finding to see
   quoted passages and details.
6. For Cross-Prompt findings, optionally click **Deep Dive** for a
   more detailed analysis of a specific flagged pair.
7. For Individual Prompt findings, review the diff view of the
   suggested full rewrite and the assumptions list before deciding
   whether to apply changes.

## Requirements

- SillyTavern 1.12.0+
- A connected LLM API (designed for use with large, capable models —
  results scale with model quality)

## Notes

- Cross-Prompt Analysis examines your **currently active** prompt
  configuration. Contradictions between prompts may not be preset
  defects — they may simply mean one prompt should be toggled off.
- Token counts and savings estimates are approximations.
- Suggested rewrites preserve the original intent of your prompts.
  Always review the assumptions and diff before applying changes.
- The extension does not modify your preset automatically. All changes
  are manual.
