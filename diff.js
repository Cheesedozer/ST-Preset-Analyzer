/**
 * Word-level diff algorithm for comparing original and rewritten prompt text.
 * Uses a longest common subsequence (LCS) approach on word tokens.
 */

/**
 * Tokenize text into words, preserving whitespace as separate tokens for accurate reconstruction.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
    const tokens = [];
    const regex = /(\S+|\n)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        tokens.push(match[0]);
    }
    return tokens;
}

/**
 * Compute the longest common subsequence of two arrays.
 * Returns an array of [indexA, indexB] pairs.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {number[][]}
 */
function lcs(a, b) {
    const m = a.length;
    const n = b.length;

    // Build LCS length table
    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Backtrack to find the actual LCS indices
    const result = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
        if (a[i - 1] === b[j - 1]) {
            result.push([i - 1, j - 1]);
            i--;
            j--;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }

    return result.reverse();
}

/**
 * Compute a word-level diff between two texts.
 * @param {string} oldText
 * @param {string} newText
 * @returns {Array<{type: 'equal'|'added'|'removed', text: string}>}
 */
export function computeWordDiff(oldText, newText) {
    const oldTokens = tokenize(oldText);
    const newTokens = tokenize(newText);
    const common = lcs(oldTokens, newTokens);

    const segments = [];
    let oldIdx = 0;
    let newIdx = 0;

    for (const [ci, cj] of common) {
        // Collect removed words before this common word
        if (oldIdx < ci) {
            segments.push({
                type: 'removed',
                text: oldTokens.slice(oldIdx, ci).join(' '),
            });
        }

        // Collect added words before this common word
        if (newIdx < cj) {
            segments.push({
                type: 'added',
                text: newTokens.slice(newIdx, cj).join(' '),
            });
        }

        // The common word itself
        segments.push({
            type: 'equal',
            text: oldTokens[ci],
        });

        oldIdx = ci + 1;
        newIdx = cj + 1;
    }

    // Remaining tokens after last common word
    if (oldIdx < oldTokens.length) {
        segments.push({
            type: 'removed',
            text: oldTokens.slice(oldIdx).join(' '),
        });
    }
    if (newIdx < newTokens.length) {
        segments.push({
            type: 'added',
            text: newTokens.slice(newIdx).join(' '),
        });
    }

    return mergeAdjacentSegments(segments);
}

/**
 * Merge adjacent segments of the same type for cleaner output.
 * @param {Array<{type: string, text: string}>} segments
 * @returns {Array<{type: string, text: string}>}
 */
function mergeAdjacentSegments(segments) {
    if (segments.length === 0) return segments;

    const merged = [segments[0]];
    for (let i = 1; i < segments.length; i++) {
        const last = merged[merged.length - 1];
        if (last.type === segments[i].type) {
            last.text += ' ' + segments[i].text;
        } else {
            merged.push(segments[i]);
        }
    }
    return merged;
}

/**
 * Render diff segments as HTML with color-coded spans.
 * @param {Array<{type: 'equal'|'added'|'removed', text: string}>} segments
 * @returns {string} HTML string
 */
export function renderDiffHtml(segments) {
    return segments.map(seg => {
        const escaped = escapeHtml(seg.text);
        switch (seg.type) {
        case 'removed':
            return `<span class="diff-removed">${escaped}</span>`;
        case 'added':
            return `<span class="diff-added">${escaped}</span>`;
        default:
            return `<span class="diff-equal">${escaped}</span>`;
        }
    }).join(' ');
}

/**
 * Escape HTML special characters.
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
