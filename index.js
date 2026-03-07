/**
 * Preset Analyzer — SillyTavern Extension
 * Analyzes prompt presets for inefficiencies, redundancies, contradictions, and other issues.
 */

import { promptManager } from '../../../../scripts/openai.js';
import {
    buildCrossPromptSystemPrompt,
    buildCrossPromptUserPrompt,
    buildIndividualSystemPrompt,
    buildIndividualUserPrompt,
    buildFollowUpSystemPrompt,
    buildFollowUpUserPrompt,
    DEFAULT_CROSS_PROMPT,
    DEFAULT_INDIVIDUAL_PROMPT,
    DEFAULT_FOLLOWUP_PROMPT,
} from './prompts.js';
import { computeWordDiff, renderDiffHtml } from './diff.js';

const MODULE_NAME = 'preset_analyzer';
const EXTENSION_FOLDER = 'ST-Preset-Analyzer';

const defaultSettings = Object.freeze({
    crossPromptEnabled: true,
    individualEnabled: true,
    customCrossPromptSystemPrompt: '',
    customIndividualSystemPrompt: '',
    customFollowUpSystemPrompt: '',
});

// ─── Settings Management ─────────────────────────────────────────────────────

function getSettings() {
    const { extensionSettings } = SillyTavern.getContext();

    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = structuredClone(defaultSettings);
    }

    for (const key of Object.keys(defaultSettings)) {
        if (!Object.hasOwn(extensionSettings[MODULE_NAME], key)) {
            extensionSettings[MODULE_NAME][key] = defaultSettings[key];
        }
    }

    return extensionSettings[MODULE_NAME];
}

// ─── Prompt Data Access ──────────────────────────────────────────────────────

/**
 * Get the raw prompts array from the prompt manager's service settings.
 * @returns {Array|null}
 */
function getRawPrompts() {
    if (!promptManager) {
        toastr.error('Prompt Manager not available. Ensure you are using the Chat Completion API.', 'Preset Analyzer');
        return null;
    }

    const allPrompts = promptManager.serviceSettings?.prompts;
    if (!allPrompts || !Array.isArray(allPrompts)) {
        toastr.error('Could not access prompt entries. Ensure a Chat Completion preset is loaded.', 'Preset Analyzer');
        return null;
    }

    return allPrompts;
}

/**
 * Get all active (enabled, non-marker) prompt entries with content.
 * @returns {Array<{identifier: string, name: string, content: string, role: string}>}
 */
function getActivePrompts() {
    const allPrompts = getRawPrompts();
    if (!allPrompts) return [];

    const results = [];

    try {
        for (const prompt of allPrompts) {
            if (prompt.marker) continue;
            if (!prompt.content || prompt.content.trim().length === 0) continue;
            if (promptManager.isPromptDisabledForActiveCharacter(prompt.identifier)) continue;

            results.push({
                identifier: prompt.identifier,
                name: prompt.name || prompt.identifier,
                content: prompt.content,
                role: prompt.role || 'system',
            });
        }
    } catch (error) {
        console.error(`[${MODULE_NAME}] Error getting active prompts:`, error);
        toastr.error('Failed to retrieve active prompts. See console for details.', 'Preset Analyzer');
        return [];
    }

    if (results.length === 0) {
        toastr.info('No active prompts found in the current preset.', 'Preset Analyzer');
    }

    return results;
}

/**
 * Get all prompts (including disabled) for the dropdown.
 * @returns {Array<{identifier: string, name: string, content: string}>}
 */
function getAllPrompts() {
    const allPrompts = getRawPrompts();
    if (!allPrompts) return [];

    try {
        return allPrompts
            .filter(p => !p.marker && p.content && p.content.trim().length > 0)
            .map(p => ({
                identifier: p.identifier,
                name: p.name || p.identifier,
                content: p.content,
            }));
    } catch (error) {
        console.error(`[${MODULE_NAME}] Error getting all prompts:`, error);
        return [];
    }
}

// ─── Token Counting ──────────────────────────────────────────────────────────

/**
 * Approximate token count for text.
 * Uses SillyTavern's tokenizer if available, falls back to word-based estimate.
 * @param {string} text
 * @returns {Promise<number>}
 */
async function countTokens(text) {
    try {
        const { getTokenCountAsync } = SillyTavern.getContext();
        if (getTokenCountAsync) {
            return await getTokenCountAsync(text);
        }
    } catch {
        // Fall through to approximation
    }

    // Rough approximation: ~1.3 tokens per word for English
    return Math.ceil(text.split(/\s+/).length * 1.3);
}

// ─── JSON Response Parsing ───────────────────────────────────────────────────

/**
 * Parse JSON from LLM response, handling markdown fences and preamble.
 * @param {string} text
 * @returns {object|null}
 */
function parseAnalysisResponse(text) {
    if (!text || typeof text !== 'string') return null;

    const trimmed = text.trim();

    // Attempt 1: Direct parse
    try {
        return JSON.parse(trimmed);
    } catch {
        // Continue to next attempt
    }

    // Attempt 2: Extract from markdown code fence
    const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
        try {
            return JSON.parse(fenceMatch[1].trim());
        } catch {
            // Continue to next attempt
        }
    }

    // Attempt 3: Find first { and last }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
            return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
        } catch {
            // All attempts failed
        }
    }

    return null;
}

// ─── Progress UI ─────────────────────────────────────────────────────────────

function showProgress(message) {
    $('#pa_progress').show();
    $('#pa_progress_text').text(message || 'Analyzing...');
}

function hideProgress() {
    $('#pa_progress').hide();
}

// ─── UI Toggle Helpers ───────────────────────────────────────────────────────

function updateSectionVisibility() {
    const settings = getSettings();
    $('#pa_cross_prompt_section').toggle(settings.crossPromptEnabled);
    $('#pa_individual_section').toggle(settings.individualEnabled);
}

// ─── Populate Prompt Dropdown ────────────────────────────────────────────────

function populatePromptDropdown() {
    const $select = $('#pa_prompt_select');
    const currentVal = $select.val();

    // Preserve static options, remove dynamic ones
    $select.find('option:not([value=""]):not([value="__all__"])').remove();

    const prompts = getAllPrompts();
    for (const prompt of prompts) {
        $select.append(
            $('<option></option>')
                .val(prompt.identifier)
                .text(prompt.name),
        );
    }

    // Restore selection if still valid
    if (currentVal && $select.find(`option[value="${currentVal}"]`).length) {
        $select.val(currentVal);
    }

    // Update context checklist for current selection
    populateContextChecklist($select.val());
}

function populateContextChecklist(selectedIdentifier) {
    const $container = $('#pa_context_prompts');
    const $list = $('#pa_context_list');
    $list.empty();

    // Only show for single prompt selection (not __all__ or empty)
    if (!selectedIdentifier || selectedIdentifier === '__all__') {
        $container.hide();
        return;
    }

    const prompts = getAllPrompts().filter(p => p.identifier !== selectedIdentifier);
    if (prompts.length === 0) {
        $container.hide();
        return;
    }

    for (const prompt of prompts) {
        const id = `pa_ctx_${prompt.identifier}`;
        $list.append(`
            <label class="checkbox_label pa_context_item" for="${id}">
                <input id="${id}" type="checkbox" data-identifier="${escapeHtml(prompt.identifier)}" />
                <span>${escapeHtml(prompt.name)}</span>
            </label>
        `);
    }

    $container.show();
}

function getSelectedContextPrompts() {
    const checked = [];
    $('#pa_context_list input:checked').each(function () {
        checked.push($(this).data('identifier'));
    });

    if (checked.length === 0) return [];

    const allPrompts = getAllPrompts();
    return checked
        .map(id => allPrompts.find(p => p.identifier === id))
        .filter(Boolean);
}

function detectContextPrompts(targetPrompt, allPrompts) {
    const targetName = targetPrompt.name.toLowerCase();
    return allPrompts.filter(p =>
        p.identifier !== targetPrompt.identifier &&
        p.content.toLowerCase().includes(targetName),
    );
}

// ─── Rendering Helpers ───────────────────────────────────────────────────────

const ISSUE_TYPE_LABELS = {
    direct_contradiction: 'Direct Contradictions',
    semantic_redundancy: 'Semantic Redundancies',
    graduated_contradiction: 'Graduated Contradictions',
    internal_self_contradiction: 'Internal Self-Contradictions',
    internal_verbosity: 'Internal Verbosity',
    vague_unactionable: 'Vague / Unactionable Instructions',
    dead_weight: 'Dead Weight',
    structural_disorganization: 'Structural Disorganization',
};

const ISSUE_TYPE_ORDER = [
    'direct_contradiction',
    'semantic_redundancy',
    'graduated_contradiction',
    'internal_self_contradiction',
    'internal_verbosity',
    'vague_unactionable',
    'dead_weight',
    'structural_disorganization',
];

function severityClass(severity) {
    switch (severity) {
    case 'high': return 'pa_severity_high';
    case 'medium': return 'pa_severity_medium';
    case 'low': return 'pa_severity_low';
    default: return 'pa_severity_low';
    }
}

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── Cross-Prompt Results Rendering ──────────────────────────────────────────

function renderCrossPromptResults(analysis, activePromptsById) {
    const $results = $('#pa_results');
    $results.empty();

    if (!analysis || !analysis.issues || analysis.issues.length === 0) {
        $results.html('<div class="pa_no_issues">No cross-prompt issues found.</div>');
        return;
    }

    // Token summary
    if (analysis.token_summary) {
        const ts = analysis.token_summary;
        $results.append(`
            <div class="pa_token_summary">
                <span>Tokens analyzed: ~${ts.total_tokens_analyzed?.toLocaleString() || '?'}</span>
                <span class="pa_token_saved">Estimated recoverable: ~${ts.estimated_recoverable_tokens?.toLocaleString() || '?'}</span>
            </div>
        `);
    }

    // Group issues by type
    const grouped = {};
    for (const issue of analysis.issues) {
        if (!grouped[issue.type]) grouped[issue.type] = [];
        grouped[issue.type].push(issue);
    }

    // Render each group in priority order
    for (const type of ISSUE_TYPE_ORDER) {
        if (!grouped[type]) continue;
        const issues = grouped[type];
        const label = ISSUE_TYPE_LABELS[type] || type;

        const $group = $(`
            <div class="pa_issue_group">
                <div class="pa_issue_group_header">
                    <span class="pa_group_title">${escapeHtml(label)}</span>
                    <span class="pa_group_count">(${issues.length} found)</span>
                    <i class="pa_group_chevron fa-solid fa-chevron-down"></i>
                </div>
                <div class="pa_issue_group_body"></div>
            </div>
        `);

        const $body = $group.find('.pa_issue_group_body');

        for (const issue of issues) {
            $body.append(renderCrossPromptFinding(issue, activePromptsById));
        }

        // Toggle collapse
        $group.find('.pa_issue_group_header').on('click', function () {
            $group.toggleClass('collapsed');
        });

        $results.append($group);
    }
}

function renderCrossPromptFinding(issue, activePromptsById) {
    const $finding = $('<div class="pa_finding"></div>');

    // Header row
    const $header = $('<div class="pa_finding_header"></div>');
    $header.append(`<span class="pa_severity ${severityClass(issue.severity)}">${escapeHtml(issue.severity)}</span>`);
    $header.append(`<span class="pa_finding_summary">${escapeHtml(issue.summary)}</span>`);

    if (issue.type === 'semantic_redundancy' || issue.type === 'graduated_contradiction') {
        if (typeof issue.confidence === 'number') {
            $header.append(`<span class="pa_confidence">${Math.round(issue.confidence * 100)}% confidence</span>`);
        }
        if (issue.likely_intentional) {
            $header.append('<span class="pa_intentional_tag">Likely Intentional</span>');
        }
    }

    $finding.append($header);

    // Involved prompts with passages
    for (const involved of (issue.involved_prompts || [])) {
        $finding.append(`
            <div class="pa_passage_label">${escapeHtml(involved.prompt_name)} (${escapeHtml(String(involved.prompt_identifier))})</div>
            <div class="pa_passage">${escapeHtml(involved.passage)}</div>
        `);
    }

    // Deep Dive button
    const $deepDive = $('<button class="menu_button pa_deep_dive_btn"><i class="fa-solid fa-magnifying-glass-plus"></i> Deep Dive</button>');
    $deepDive.on('click', async function () {
        $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...');
        await runFollowUp(issue, activePromptsById, $finding);
        $(this).remove();
    });
    $finding.append($deepDive);

    return $finding;
}

function renderFollowUpResults($parentFinding, followup) {
    if (!followup) {
        $parentFinding.append('<div class="pa_error">Failed to parse follow-up analysis.</div>');
        return;
    }

    const $fu = $('<div class="pa_followup"></div>');
    $fu.append('<div class="pa_section_header">Deep Dive Analysis</div>');
    $fu.append(`<div class="pa_followup_analysis">${escapeHtml(followup.detailed_analysis)}</div>`);

    if (followup.recommendation) {
        $fu.append(`
            <div style="margin-top: 6px;">
                <span class="pa_recommendation_badge">${escapeHtml(followup.recommendation)}</span>
            </div>
        `);
    }
    if (followup.recommendation_detail) {
        $fu.append(`<div class="pa_explanation">${escapeHtml(followup.recommendation_detail)}</div>`);
    }

    $parentFinding.append($fu);
}

// ─── Individual Prompt Results Rendering ─────────────────────────────────────

function renderIndividualResults(analysis, contextNames) {
    const $container = $('<div class="pa_individual_result"></div>');

    const promptLabel = analysis.prompt_name || analysis.prompt_identifier || 'Unknown';
    $container.append(`
        <div class="pa_individual_result_header">
            <span>${escapeHtml(promptLabel)}</span>
            <span class="pa_group_count">(${analysis.issues?.length || 0} issues)</span>
            <i class="pa_group_chevron fa-solid fa-chevron-down"></i>
        </div>
    `);

    const $body = $('<div class="pa_individual_result_body"></div>');

    // Context tag
    if (contextNames && contextNames.length > 0) {
        $body.append(`<div class="pa_context_tag">Analyzed with context from: ${contextNames.map(n => escapeHtml(n)).join(', ')}</div>`);
    }

    if (!analysis.issues || analysis.issues.length === 0) {
        $body.append('<div class="pa_no_issues">No issues found in this prompt.</div>');
    } else {
        // Group issues by type
        const grouped = {};
        for (const issue of analysis.issues) {
            if (!grouped[issue.type]) grouped[issue.type] = [];
            grouped[issue.type].push(issue);
        }

        for (const type of ISSUE_TYPE_ORDER) {
            if (!grouped[type]) continue;
            const issues = grouped[type];
            const label = ISSUE_TYPE_LABELS[type] || type;

            $body.append(`<div class="pa_section_header">${escapeHtml(label)} (${issues.length})</div>`);

            for (const issue of issues) {
                const $finding = $('<div class="pa_finding"></div>');

                $finding.append(`
                    <div class="pa_finding_header">
                        <span class="pa_severity ${severityClass(issue.severity)}">${escapeHtml(issue.severity)}</span>
                    </div>
                `);

                if (issue.passage) {
                    $finding.append(`
                        <div class="pa_passage_label">Flagged Passage</div>
                        <div class="pa_passage">${escapeHtml(issue.passage)}</div>
                    `);
                }

                if (issue.explanation) {
                    $finding.append(`<div class="pa_explanation">${escapeHtml(issue.explanation)}</div>`);
                }

                if (issue.suggested_rewrite) {
                    $finding.append(`
                        <div class="pa_suggested_rewrite_label">Suggested Rewrite</div>
                        <div class="pa_suggested_rewrite">${escapeHtml(issue.suggested_rewrite)}</div>
                    `);
                }

                $body.append($finding);
            }
        }
    }

    // Full rewrite section
    if (analysis.suggested_full_rewrite && analysis.suggested_full_rewrite.text) {
        const rewrite = analysis.suggested_full_rewrite;

        const $rewriteHeader = $('<div class="pa_section_header pa_rewrite_header_row">Full Rewrite</div>');
        const $copyBtn = $('<button class="menu_button pa_copy_rewrite_btn" title="Copy clean rewrite to clipboard"><i class="fa-solid fa-copy"></i> <span>Copy Rewrite</span></button>');
        $copyBtn.on('click', async function (e) {
            e.stopPropagation();
            try {
                await navigator.clipboard.writeText(rewrite.text);
                const $span = $(this).find('span');
                $span.text('Copied!');
                setTimeout(() => $span.text('Copy Rewrite'), 1500);
            } catch {
                toastr.error('Failed to copy to clipboard.', 'Preset Analyzer');
            }
        });
        $rewriteHeader.append($copyBtn);
        $body.append($rewriteHeader);

        // Token savings
        const tokenInfo = [];
        if (analysis.original_token_count) tokenInfo.push(`Original: ~${analysis.original_token_count.toLocaleString()}`);
        if (rewrite.rewrite_token_count) tokenInfo.push(`Rewritten: ~${rewrite.rewrite_token_count.toLocaleString()}`);
        if (rewrite.estimated_tokens_saved) tokenInfo.push(`<span class="pa_token_saved">Saved: ~${rewrite.estimated_tokens_saved.toLocaleString()}</span>`);

        if (tokenInfo.length > 0) {
            $body.append(`<div class="pa_token_summary">${tokenInfo.join(' &rarr; ')}</div>`);
        }

        // Assumptions
        if (rewrite.assumptions && rewrite.assumptions.length > 0) {
            const assumptionItems = rewrite.assumptions.map(a => `<li>${escapeHtml(a)}</li>`).join('');
            $body.append(`
                <div class="pa_assumptions">
                    <div class="pa_assumptions_title">Assumptions Made</div>
                    <ul>${assumptionItems}</ul>
                </div>
            `);
        }

        // Diff view — find original prompt content for comparison
        const originalPrompt = getAllPrompts().find(p =>
            p.identifier === analysis.prompt_identifier ||
            p.name === analysis.prompt_name,
        );
        const originalText = originalPrompt?.content || '';

        if (originalText) {
            const diffSegments = computeWordDiff(originalText, rewrite.text);
            const diffHtml = renderDiffHtml(diffSegments);
            $body.append(`<div class="pa_diff_container">${diffHtml}</div>`);
        } else {
            // If we can't find the original, just show the rewrite
            $body.append(`<div class="pa_diff_container">${escapeHtml(rewrite.text)}</div>`);
        }
    }

    $container.append($body);

    // Toggle collapse on header click
    $container.find('.pa_individual_result_header').on('click', function () {
        $body.toggle();
        $container.find('.pa_group_chevron').toggleClass('collapsed');
    });

    return $container;
}

// ─── Analysis Orchestration ──────────────────────────────────────────────────

async function runCrossPromptAnalysis() {
    const { generateRaw } = SillyTavern.getContext();
    const $results = $('#pa_results');
    $results.empty();

    const activePrompts = getActivePrompts();
    if (activePrompts.length === 0) return;

    if (activePrompts.length < 2) {
        toastr.info('Cross-prompt analysis requires at least 2 active prompts.', 'Preset Analyzer');
        return;
    }

    showProgress(`Analyzing ${activePrompts.length} active prompts...`);

    try {
        const settings = getSettings();
        const systemPrompt = buildCrossPromptSystemPrompt(settings.customCrossPromptSystemPrompt || undefined);
        const prompt = buildCrossPromptUserPrompt(activePrompts);

        const result = await generateRaw({
            systemPrompt,
            prompt,
        });

        const analysis = parseAnalysisResponse(result);

        if (!analysis) {
            toastr.warning('Failed to parse analysis response. The model may not have returned valid JSON.', 'Preset Analyzer');
            $results.html(`<div class="pa_error">Failed to parse response. Raw output:<br><pre>${escapeHtml(result?.substring(0, 2000) || '(empty)')}</pre></div>`);
            return;
        }

        // Build lookup map
        const activePromptsById = {};
        for (const p of activePrompts) {
            activePromptsById[p.identifier] = p;
        }

        renderCrossPromptResults(analysis, activePromptsById);
    } catch (error) {
        console.error(`[${MODULE_NAME}] Cross-prompt analysis error:`, error);
        toastr.error(`Analysis failed: ${error.message}`, 'Preset Analyzer');
    } finally {
        hideProgress();
    }
}

async function runIndividualAnalysis(promptIdentifier) {
    const { generateRaw } = SillyTavern.getContext();
    const $results = $('#pa_results');

    const allPrompts = getAllPrompts();
    if (allPrompts.length === 0) {
        toastr.info('No prompts available for analysis.', 'Preset Analyzer');
        return;
    }

    // Gather context prompts (manual selection for single prompt, auto-detect for __all__)
    const isAnalyzeAll = promptIdentifier === '__all__';
    const manualContextPrompts = !isAnalyzeAll ? getSelectedContextPrompts() : [];

    let promptsToAnalyze;
    if (isAnalyzeAll) {
        promptsToAnalyze = allPrompts;
        $results.empty();
    } else {
        const target = allPrompts.find(p => p.identifier === promptIdentifier);
        if (!target) {
            toastr.error('Selected prompt not found.', 'Preset Analyzer');
            return;
        }
        promptsToAnalyze = [target];
        $results.empty();
    }

    const settings = getSettings();
    const systemPrompt = buildIndividualSystemPrompt(settings.customIndividualSystemPrompt || undefined);

    for (let i = 0; i < promptsToAnalyze.length; i++) {
        const prompt = promptsToAnalyze[i];
        showProgress(`Analyzing prompt ${i + 1}/${promptsToAnalyze.length}: ${prompt.name}...`);

        // For Analyze All, auto-detect context per prompt; for single, use manual selection
        const contextPrompts = isAnalyzeAll
            ? detectContextPrompts(prompt, allPrompts)
            : manualContextPrompts;

        try {
            const userPrompt = buildIndividualUserPrompt(prompt, contextPrompts);

            const result = await generateRaw({
                systemPrompt,
                prompt: userPrompt,
            });

            const analysis = parseAnalysisResponse(result);

            if (!analysis) {
                $results.append(`<div class="pa_error">Failed to parse response for "${escapeHtml(prompt.name)}". Raw output:<br><pre>${escapeHtml(result?.substring(0, 1000) || '(empty)')}</pre></div>`);
                continue;
            }

            // Ensure prompt metadata is populated
            if (!analysis.prompt_name) analysis.prompt_name = prompt.name;
            if (!analysis.prompt_identifier) analysis.prompt_identifier = prompt.identifier;

            const contextNames = contextPrompts.map(p => p.name);
            const $promptResult = renderIndividualResults(analysis, contextNames);
            $results.append($promptResult);
        } catch (error) {
            console.error(`[${MODULE_NAME}] Individual analysis error for ${prompt.name}:`, error);
            $results.append(`<div class="pa_error">Analysis failed for "${escapeHtml(prompt.name)}": ${escapeHtml(error.message)}</div>`);
        }
    }

    hideProgress();
}

async function runFollowUp(issue, activePromptsById, $parentFinding) {
    const { generateRaw } = SillyTavern.getContext();

    try {
        const settings = getSettings();
        const systemPrompt = buildFollowUpSystemPrompt(settings.customFollowUpSystemPrompt || undefined);
        const userPrompt = buildFollowUpUserPrompt(issue, activePromptsById);

        const result = await generateRaw({
            systemPrompt,
            prompt: userPrompt,
        });

        const followup = parseAnalysisResponse(result);
        renderFollowUpResults($parentFinding, followup);
    } catch (error) {
        console.error(`[${MODULE_NAME}] Follow-up analysis error:`, error);
        $parentFinding.append(`<div class="pa_error">Follow-up analysis failed: ${escapeHtml(error.message)}</div>`);
    }
}

// ─── Initialization ──────────────────────────────────────────────────────────

(async function init() {
    const context = SillyTavern.getContext();
    const { eventSource, event_types, saveSettingsDebounced } = context;

    // Load and inject settings HTML
    try {
        const settingsHtml = await $.get(
            `/scripts/extensions/third-party/${EXTENSION_FOLDER}/settings.html`,
        );
        $('#extensions_settings2').append(settingsHtml);
    } catch (error) {
        console.error(`[${MODULE_NAME}] Failed to load settings HTML:`, error);
        return;
    }

    // Initialize settings
    const settings = getSettings();

    // Sync UI with settings
    $('#pa_cross_prompt_enabled').prop('checked', settings.crossPromptEnabled);
    $('#pa_individual_enabled').prop('checked', settings.individualEnabled);
    updateSectionVisibility();

    // Bind setting toggles
    $('#pa_cross_prompt_enabled').on('change', function () {
        const s = getSettings();
        s.crossPromptEnabled = $(this).prop('checked');
        saveSettingsDebounced();
        updateSectionVisibility();
    });

    $('#pa_individual_enabled').on('change', function () {
        const s = getSettings();
        s.individualEnabled = $(this).prop('checked');
        saveSettingsDebounced();
        updateSectionVisibility();
    });

    // Sync custom prompt textareas with settings
    const promptFields = [
        { id: '#pa_custom_cross_prompt', key: 'customCrossPromptSystemPrompt', defaultText: DEFAULT_CROSS_PROMPT, resetId: '#pa_reset_cross_prompt' },
        { id: '#pa_custom_individual_prompt', key: 'customIndividualSystemPrompt', defaultText: DEFAULT_INDIVIDUAL_PROMPT, resetId: '#pa_reset_individual_prompt' },
        { id: '#pa_custom_followup_prompt', key: 'customFollowUpSystemPrompt', defaultText: DEFAULT_FOLLOWUP_PROMPT, resetId: '#pa_reset_followup_prompt' },
    ];

    for (const { id, key, defaultText, resetId } of promptFields) {
        const $textarea = $(id);
        $textarea.val(settings[key] || defaultText);

        $textarea.on('input', function () {
            const s = getSettings();
            const val = $(this).val();
            s[key] = val === defaultText ? '' : val;
            saveSettingsDebounced();
        });

        $(resetId).on('click', function () {
            const s = getSettings();
            s[key] = '';
            $textarea.val(defaultText);
            saveSettingsDebounced();
            toastr.info('Prompt reset to default.', 'Preset Analyzer');
        });
    }

    // Bind analysis buttons
    $('#pa_run_cross_prompt').on('click', async function () {
        $(this).prop('disabled', true);
        try {
            await runCrossPromptAnalysis();
        } finally {
            $(this).prop('disabled', false);
        }
    });

    $('#pa_run_individual').on('click', async function () {
        const selected = $('#pa_prompt_select').val();
        if (!selected) {
            toastr.info('Please select a prompt to analyze.', 'Preset Analyzer');
            return;
        }
        $(this).prop('disabled', true);
        try {
            await runIndividualAnalysis(selected);
        } finally {
            $(this).prop('disabled', false);
        }
    });

    // Populate prompt dropdown and bind context checklist update
    populatePromptDropdown();
    $('#pa_prompt_select').on('change', function () {
        populateContextChecklist($(this).val());
    });

    // Auto-detect related context prompts
    $('#pa_auto_detect_context').on('click', function () {
        const selectedId = $('#pa_prompt_select').val();
        if (!selectedId || selectedId === '__all__') return;

        const allPrompts = getAllPrompts();
        const targetPrompt = allPrompts.find(p => p.identifier === selectedId);
        if (!targetPrompt) return;

        const matches = detectContextPrompts(targetPrompt, allPrompts);

        // Check matching checkboxes
        $('#pa_context_list input').each(function () {
            const id = $(this).data('identifier');
            $(this).prop('checked', matches.some(m => m.identifier === id));
        });

        if (matches.length > 0) {
            toastr.info(`Found ${matches.length} related prompt(s).`, 'Preset Analyzer');
        } else {
            toastr.info('No related prompts found.', 'Preset Analyzer');
        }
    });

    // Refresh dropdown on relevant events
    eventSource.on(event_types.CHAT_CHANGED, () => populatePromptDropdown());
    if (event_types.PRESET_CHANGED) {
        eventSource.on(event_types.PRESET_CHANGED, () => populatePromptDropdown());
    }

    console.log(`[${MODULE_NAME}] Extension loaded successfully`);
})();
