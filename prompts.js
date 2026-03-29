/**
 * Analysis prompt builders for the Preset Analyzer extension.
 * Each function returns a string to be used as system or user prompt in generateRaw().
 */

import { CROSS_PROMPT_SCHEMA, INDIVIDUAL_PROMPT_SCHEMA, INDIVIDUAL_ISSUES_SCHEMA, INDIVIDUAL_REWRITE_SCHEMA, FOLLOWUP_SCHEMA } from './schemas.js';

// ─── Default System Prompts (exported for settings UI) ──────────────────────

export const DEFAULT_CROSS_PROMPT = `You are an expert prompt engineer analyzing a SillyTavern preset configuration. Your task is to examine the currently active/enabled prompt entries provided and identify cross-prompt issues.

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
- Some prompts may be marked as Inactive. Include them in your analysis but note in each finding whether the involved prompts are active or inactive, as inactive prompts do not currently affect model behavior.
- Estimate recoverable tokens conservatively.
- Do NOT suggest rewrites in this phase — only identify and quote.`;

export const DEFAULT_INDIVIDUAL_PROMPT = `You are an expert prompt engineer analyzing a single prompt entry from a SillyTavern preset for internal quality issues.

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
- List ALL assumptions you made during the full rewrite explicitly.`;

export const DEFAULT_INDIVIDUAL_ISSUES_PROMPT = `You are an expert prompt engineer analyzing a single prompt entry from a SillyTavern preset for internal quality issues.

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

Do NOT generate a full rewrite of the prompt — only identify issues and provide per-issue passage rewrites.`;

export const DEFAULT_COT_ISSUES_PROMPT = `You are an expert prompt engineer specializing in Chain of Thought (CoT) prompt analysis. You are analyzing a single CoT prompt entry from a SillyTavern preset for quality issues.

CoT prompts structure the model's thinking process before creative output. Every token spent on thinking directly reduces tokens available for the actual output. Your analysis must account for this tradeoff.

You must identify issues from EXACTLY these ten categories:

**Standard prompt issues (still apply to CoT prompts):**

1. **Internal Self-Contradiction** (severity: high) — The prompt contradicts itself.
2. **Internal Verbosity** (severity: medium) — Uses significantly more tokens than needed to convey its instructions.
3. **Vague / Unactionable Instructions** (severity: medium) — Directives too abstract for the model to meaningfully follow.
4. **Dead Weight** (severity: medium) — Instructions the model is likely to ignore — too vague, fighting base training, impossible/never-triggered conditions.
5. **Structural Disorganization** (severity: low) — Poor grouping or ordering of instructions within the prompt, making it harder for the model to parse.

**CoT-specific issues:**

6. **Counterproductive Priming** (severity: high) — A thinking step that activates the very patterns it is trying to prevent. For example, asking the model to "list all rules you might violate" primes violation patterns in the model's attention immediately before generation. Also includes steps that ask the model to enumerate bad examples, anti-patterns, or failure modes without a clear corrective framing, which increases the likelihood of those behaviors appearing in output.
7. **Low-Value Thinking Step** (severity: medium) — A thinking step that consumes the model's thinking token budget without meaningfully improving output quality. In CoT prompts, every token spent thinking is a token NOT available for the actual creative output. Flag steps that are ceremonial, redundant with what the model would naturally do, or that produce busywork rather than genuine reasoning. Consider whether the step's output actually influences the final generation.
8. **Missing Critical Step** (severity: medium) — An important reasoning stage that the CoT should include but does not. Common missing steps include: output language confirmation (especially when thinking and output languages differ), character voice/tone calibration before writing, continuity checks against recent context, pacing decisions for how much plot to advance, and explicit transition from thinking to output. Flag only steps whose absence would likely cause concrete generation failures, not hypothetical nice-to-haves.
9. **Granularity Mismatch** (severity: medium) — Thinking steps calibrated too broadly or too narrowly for productive reasoning. Steps that are too broad (e.g., "think about the story") let the model wander without structure. Steps that are too numerous or too narrow cause the model to rush through each one superficially, producing shallow bullet points rather than genuine reasoning. Also flag missing depth/word budgets for steps that need them, or budgets that are unrealistically tight or generous for what the step asks.
10. **Model-Incompatible Structure** (severity: high) — Structural choices in the CoT that may conflict with the target model's capabilities or native features. This includes: tag formats that clash with the model's built-in extended thinking (e.g., using <think> tags on models with native chain-of-thought), language directives the model handles poorly (e.g., thinking in a language the model is weak in), prefill patterns unsupported by the target API, reliance on features specific to one model family, and CoT ordering or placement that fights the model's natural processing flow.

For EACH issue found:
- Quote the SPECIFIC passage (or identify the specific thinking step) from the prompt that has the issue.
- Explain WHY it is a problem and what impact it has on model behavior. Be educational.
- Provide a suggested rewrite of JUST that passage that preserves the original intent while fixing the issue.

Do NOT generate a full rewrite of the prompt — only identify issues and provide per-issue passage rewrites.`;

export const DEFAULT_INDIVIDUAL_REWRITE_PROMPT = `You are an expert prompt engineer. You are given a prompt and a list of previously identified issues in that prompt. Your task is to generate a FULL REWRITE of the entire prompt that addresses all the identified issues simultaneously.

Critical rewrite rules:
- Your goal is to preserve the EXACT behavioral intent of the original prompt while reducing token count.
- Do NOT change what the prompt instructs the model to do.
- Do NOT impose your own stylistic preferences.
- Only tighten phrasing, remove genuine redundancy, and clarify vague instructions.
- Preserve ALL SillyTavern macros (e.g., {{char}}, {{user}}, {{persona}}) exactly as they appear.
- If you are uncertain whether something is intentional, note it in your assumptions rather than removing it.
- List ALL assumptions you made during the full rewrite explicitly.
- Include the rewrite token count and estimated tokens saved compared to the original.`;

export const DEFAULT_FOLLOWUP_PROMPT = `You are an expert prompt engineer performing a deep analysis of a specific cross-prompt issue in a SillyTavern preset.

You are given:
- A previously identified issue (summary provided).
- The full text of the involved prompts.

Your task:
- Deeply analyze the relationship between the provided prompts.
- Explain how the model likely processes and prioritizes the conflicting or redundant instructions.
- Provide a specific actionable recommendation: consolidate, keep_both, disable_one, or rewrite.
- Give detailed guidance on what to do.`;

// ─── Schema Suffix Builders ─────────────────────────────────────────────────

function appendSchema(promptText, schema) {
    return `${promptText}\n\n- The text contains placeholders like [MACRO_0], [MACRO_1], etc. These represent template macros used by the application. A MACRO REFERENCE section in the user message describes each placeholder. Macros marked "analyzable" contain authored content — analyze and critique their content as you would any other prompt text. Macros marked "template variable" are runtime-substituted values — do not analyze their content. In suggested rewrites: for analyzable macros you may output the full macro syntax (e.g., {{setvar::key::improved content}}) with revised content; for template variables and any macros you do not modify, preserve the [MACRO_N] placeholder exactly.\n\n- CRITICAL: When quoting passages that contain quotation marks, you MUST escape them as \\" in the JSON output. Unescaped quotes inside JSON string values will break parsing.\n\n- Return ONLY the raw JSON object matching this schema exactly. Do not wrap it in markdown code fences. Do not include any text before or after the JSON.\n\n${JSON.stringify(schema, null, 2)}`;
}

// ─── Phase 2: Cross-Prompt Analysis ─────────────────────────────────────────

export function buildCrossPromptSystemPrompt(customPrompt) {
    const base = customPrompt || DEFAULT_CROSS_PROMPT;
    return appendSchema(base, CROSS_PROMPT_SCHEMA.value);
}

export function buildCrossPromptUserPrompt(prompts) {
    let text = 'Analyze the following preset prompts for cross-prompt issues.\nReturn your analysis as valid JSON matching the schema described in your instructions.\n\n--- PROMPTS ---\n';

    for (const prompt of prompts) {
        const statusLabel = prompt.status ? ` | Status: ${prompt.status}` : '';
        text += `\n[Prompt - Name: "${prompt.name}" | Identifier: ${prompt.identifier}${statusLabel}]\n${prompt.content}\n`;
    }

    return text;
}

// ─── Phase 1: Individual Prompt Analysis ────────────────────────────────────

export function buildIndividualSystemPrompt(customPrompt) {
    const base = customPrompt || DEFAULT_INDIVIDUAL_PROMPT;
    return appendSchema(base, INDIVIDUAL_PROMPT_SCHEMA.value);
}

export function buildIndividualUserPrompt(prompt, contextPrompts) {
    let text = `Analyze the following prompt entry for internal quality issues.
Return your analysis as valid JSON matching the schema described in your instructions.

Prompt Name: "${prompt.name}"
Prompt Identifier: ${prompt.identifier}

--- PROMPT TEXT ---
${prompt.content}`;

    if (contextPrompts && contextPrompts.length > 0) {
        text += `\n\n--- CONTEXT PROMPTS ---
The following additional prompts are provided as context only. Do NOT analyze them. Use them solely to inform your understanding of the target prompt's intent, references, and how it fits within the broader preset.\n`;

        for (const ctx of contextPrompts) {
            text += `\n[Context Prompt - Name: "${ctx.name}" | Identifier: ${ctx.identifier}]\n${ctx.content}\n`;
        }
    }

    return text;
}

// ─── Phase 1 Split: Issues Only ─────────────────────────────────────────────

export function buildIndividualIssuesSystemPrompt(customPrompt) {
    const base = customPrompt || DEFAULT_INDIVIDUAL_ISSUES_PROMPT;
    return appendSchema(base, INDIVIDUAL_ISSUES_SCHEMA.value);
}

export function buildIndividualIssuesUserPrompt(prompt, contextPrompts) {
    return buildIndividualUserPrompt(prompt, contextPrompts);
}

// ─── Phase 1 Split: Single Issue Type ───────────────────────────────────────

export function buildSingleIssueTypeIssuesSystemPrompt(issueTypeDef) {
    const base = `You are an expert prompt engineer analyzing a single prompt entry from a SillyTavern preset for one specific type of internal quality issue.

You must search for ONLY this issue type:

**${issueTypeDef.label}** (severity: ${issueTypeDef.severity}) — ${issueTypeDef.description}

For EACH instance found:
- Quote the SPECIFIC passage from the prompt that has the issue.
- Explain WHY it is a problem and what impact it has on model behavior. Be educational.
- Provide a suggested rewrite of JUST that passage that preserves the original intent while fixing the issue.

Do NOT look for any other issue types. Do NOT generate a full rewrite.
If no issues of this type are found, return an empty issues array.`;
    return appendSchema(base, INDIVIDUAL_ISSUES_SCHEMA.value);
}

// ─── Phase 1 Split: Full Rewrite Only ───────────────────────────────────────

export function buildIndividualRewriteSystemPrompt(customPrompt) {
    const base = customPrompt || DEFAULT_INDIVIDUAL_REWRITE_PROMPT;
    return appendSchema(base, INDIVIDUAL_REWRITE_SCHEMA.value);
}

export function buildIndividualRewriteUserPrompt(prompt, issues) {
    const issuesSummary = issues.map((issue, i) => {
        let entry = `${i + 1}. [${issue.type}] (${issue.severity})\n   Passage: "${issue.passage}"\n   Explanation: ${issue.explanation}`;
        if (issue.suggested_rewrite) {
            entry += `\n   Suggested rewrite: "${issue.suggested_rewrite}"`;
        }
        return entry;
    }).join('\n\n');

    return `Generate a full rewrite of the following prompt that addresses all the identified issues.
Return your response as valid JSON matching the schema described in your instructions.

Prompt Name: "${prompt.name}"
Prompt Identifier: ${prompt.identifier}

--- ORIGINAL PROMPT TEXT ---
${prompt.content}

--- IDENTIFIED ISSUES ---
${issuesSummary}`;
}

// ─── Phase 2: Targeted Follow-Up ────────────────────────────────────────────

export function buildFollowUpSystemPrompt(customPrompt) {
    const base = customPrompt || DEFAULT_FOLLOWUP_PROMPT;
    return appendSchema(base, FOLLOWUP_SCHEMA.value);
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
