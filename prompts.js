/**
 * Analysis prompt builders for the Preset Analyzer extension.
 * Each function returns a string to be used as system or user prompt in generateRaw().
 */

import { CROSS_PROMPT_SCHEMA, INDIVIDUAL_PROMPT_SCHEMA, FOLLOWUP_SCHEMA } from './schemas.js';

// ─── Phase 2: Cross-Prompt Analysis ─────────────────────────────────────────

export function buildCrossPromptSystemPrompt() {
    return `You are an expert prompt engineer analyzing a SillyTavern preset configuration. Your task is to examine the currently active/enabled prompt entries provided and identify cross-prompt issues.

You must identify issues from EXACTLY these three categories:

1. **Direct Contradiction** (severity: high) — Two active prompts give the model opposing directives. Frame as: "These two prompts give the model opposing instructions."

2. **Semantic Redundancy** (severity: high) — The same instruction is repeated across prompts in different words. You MUST provide:
   - A \`confidence\` score (0–1) indicating how certain you are that the passages convey the same instruction.
   - A \`likely_intentional\` boolean flag — set to true when the redundancy appears to be strategic reinforcement (e.g., a critical behavioral constraint repeated in both the system prompt and a character-specific prompt for emphasis).
   Frame as: "Both prompts convey the same instruction. This may be intentional reinforcement."

3. **Graduated Contradiction** (severity: low) — Two prompts pull different *degrees* of the same behavioral axis (e.g., "be concise" vs. "write elaborate descriptions"). Not a full reversal. Frame as: "These prompts create tension around [axis]. This may be intentional to produce a balanced result."

Rules:
- Quote SPECIFIC passages from each involved prompt. Do NOT paraphrase or generalize.
- Only analyze the prompts provided — do not infer or assume prompts that are not shown.
- Estimate recoverable tokens conservatively.
- Do NOT suggest rewrites in this phase — only identify and quote.
- Return ONLY valid JSON matching this schema exactly:

${JSON.stringify(CROSS_PROMPT_SCHEMA.value, null, 2)}`;
}

export function buildCrossPromptUserPrompt(prompts) {
    let text = 'Analyze the following active preset prompts for cross-prompt issues.\nReturn your analysis as valid JSON matching the schema described in your instructions.\n\n--- ACTIVE PROMPTS ---\n';

    for (const prompt of prompts) {
        text += `\n[Prompt - Name: "${prompt.name}" | Identifier: ${prompt.identifier}]\n${prompt.content}\n`;
    }

    return text;
}

// ─── Phase 1: Individual Prompt Analysis ────────────────────────────────────

export function buildIndividualSystemPrompt() {
    return `You are an expert prompt engineer analyzing a single prompt entry from a SillyTavern preset for internal quality issues.

You must identify issues from EXACTLY these five categories:

1. **Internal Self-Contradiction** (severity: high) — The prompt contradicts itself.
2. **Internal Verbosity** (severity: medium) — Uses significantly more tokens than needed to convey its instructions.
3. **Vague / Unactionable Instructions** (severity: medium) — Directives too abstract for the model to meaningfully follow.
4. **Dead Weight** (severity: medium) — Instructions the model is likely to ignore — too vague, fighting base training, impossible/never-triggered conditions.
5. **Structural Disorganization** (severity: low) — Poor grouping or ordering of instructions within the prompt, making it harder for the model to parse.

For EACH issue found:
- Quote the SPECIFIC passage from the prompt that has the issue.
- Explain WHY it is a problem and what impact it has on model behavior. Be educational.
- Provide a suggested rewrite of JUST that passage that preserves the original intent while fixing the issue.

Then generate a FULL REWRITE of the entire prompt that addresses all identified issues simultaneously.

Critical rewrite rules:
- Your goal is to preserve the EXACT behavioral intent of the original prompt while reducing token count.
- Do NOT change what the prompt instructs the model to do.
- Do NOT impose your own stylistic preferences.
- Only tighten phrasing, remove genuine redundancy, and clarify vague instructions.
- Preserve ALL SillyTavern macros (e.g., {{char}}, {{user}}, {{persona}}) exactly as they appear.
- If you are uncertain whether something is intentional, note it in your assumptions rather than removing it.
- List ALL assumptions you made during the full rewrite explicitly.

Return ONLY valid JSON matching this schema exactly:

${JSON.stringify(INDIVIDUAL_PROMPT_SCHEMA.value, null, 2)}`;
}

export function buildIndividualUserPrompt(prompt) {
    return `Analyze the following prompt entry for internal quality issues.
Return your analysis as valid JSON matching the schema described in your instructions.

Prompt Name: "${prompt.name}"
Prompt Identifier: ${prompt.identifier}

--- PROMPT TEXT ---
${prompt.content}`;
}

// ─── Phase 2: Targeted Follow-Up ────────────────────────────────────────────

export function buildFollowUpSystemPrompt() {
    return `You are an expert prompt engineer performing a deep analysis of a specific cross-prompt issue in a SillyTavern preset.

You are given:
- A previously identified issue (summary provided).
- The full text of the involved prompts.

Your task:
- Deeply analyze the relationship between the provided prompts.
- Explain how the model likely processes and prioritizes the conflicting or redundant instructions.
- Provide a specific actionable recommendation: consolidate, keep_both, disable_one, or rewrite.
- Give detailed guidance on what to do.

Return ONLY valid JSON matching this schema exactly:

${JSON.stringify(FOLLOWUP_SCHEMA.value, null, 2)}`;
}

export function buildFollowUpUserPrompt(issue, promptsById) {
    let text = `Perform a deep analysis of the following cross-prompt issue.\nReturn your analysis as valid JSON matching the schema described in your instructions.\n\nOriginal Issue Summary: ${issue.summary}\nIssue Type: ${issue.type}\n\n--- INVOLVED PROMPTS (FULL TEXT) ---\n`;

    for (const involved of issue.involved_prompts) {
        const fullPrompt = promptsById[involved.prompt_identifier];
        const fullText = fullPrompt ? fullPrompt.content : involved.passage;
        text += `\n[Prompt - Name: "${involved.prompt_name}" | Identifier: ${involved.prompt_identifier}]\n${fullText}\n`;
    }

    return text;
}
