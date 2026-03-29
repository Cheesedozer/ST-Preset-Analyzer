/**
 * JSON Schema definitions for structured LLM output.
 * Used both for instructing the model and for basic validation.
 */

export const CROSS_PROMPT_SCHEMA = {
    name: 'CrossPromptAnalysis',
    description: 'Schema for cross-prompt preset analysis results.',
    strict: true,
    value: {
        '$schema': 'http://json-schema.org/draft-04/schema#',
        'type': 'object',
        'properties': {
            'analysis_type': {
                'type': 'string',
                'enum': ['cross_prompt'],
            },
            'issues': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'type': {
                            'type': 'string',
                            'enum': ['semantic_redundancy', 'direct_contradiction', 'graduated_contradiction'],
                        },
                        'severity': {
                            'type': 'string',
                            'enum': ['high', 'medium', 'low'],
                        },
                        'confidence': {
                            'type': 'number',
                        },
                        'likely_intentional': {
                            'type': 'boolean',
                        },
                        'summary': {
                            'type': 'string',
                        },
                        'involved_prompts': {
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'properties': {
                                    'prompt_name': { 'type': 'string' },
                                    'prompt_identifier': { 'type': ['string', 'number'] },
                                    'passage': { 'type': 'string' },
                                },
                                'required': ['prompt_name', 'prompt_identifier', 'passage'],
                            },
                        },
                    },
                    'required': ['type', 'severity', 'confidence', 'likely_intentional', 'summary', 'involved_prompts'],
                },
            },
            'token_summary': {
                'type': 'object',
                'properties': {
                    'total_tokens_analyzed': { 'type': 'integer' },
                    'estimated_recoverable_tokens': { 'type': 'integer' },
                },
                'required': ['total_tokens_analyzed', 'estimated_recoverable_tokens'],
            },
        },
        'required': ['analysis_type', 'issues', 'token_summary'],
    },
};

export const INDIVIDUAL_PROMPT_SCHEMA = {
    name: 'IndividualPromptAnalysis',
    description: 'Schema for individual prompt analysis results.',
    strict: true,
    value: {
        '$schema': 'http://json-schema.org/draft-04/schema#',
        'type': 'object',
        'properties': {
            'analysis_type': {
                'type': 'string',
                'enum': ['individual_prompt'],
            },
            'prompt_name': { 'type': 'string' },
            'prompt_identifier': { 'type': ['string', 'number'] },
            'original_token_count': { 'type': 'integer' },
            'issues': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'type': {
                            'type': 'string',
                            'enum': ['internal_verbosity', 'vague_unactionable', 'internal_self_contradiction', 'dead_weight', 'structural_disorganization', 'counterproductive_priming', 'low_value_thinking_step', 'missing_critical_step', 'granularity_mismatch', 'model_incompatible_structure'],
                        },
                        'severity': {
                            'type': 'string',
                            'enum': ['high', 'medium', 'low'],
                        },
                        'passage': { 'type': 'string' },
                        'explanation': { 'type': 'string' },
                        'suggested_rewrite': { 'type': 'string' },
                    },
                    'required': ['type', 'severity', 'passage', 'explanation', 'suggested_rewrite'],
                },
            },
            'suggested_full_rewrite': {
                'type': 'object',
                'properties': {
                    'text': { 'type': 'string' },
                    'assumptions': {
                        'type': 'array',
                        'items': { 'type': 'string' },
                    },
                    'rewrite_token_count': { 'type': 'integer' },
                    'estimated_tokens_saved': { 'type': 'integer' },
                },
                'required': ['text', 'assumptions', 'rewrite_token_count', 'estimated_tokens_saved'],
            },
        },
        'required': ['analysis_type', 'prompt_name', 'prompt_identifier', 'original_token_count', 'issues', 'suggested_full_rewrite'],
    },
};

export const INDIVIDUAL_ISSUES_SCHEMA = {
    name: 'IndividualPromptIssues',
    description: 'Schema for individual prompt issue detection (no full rewrite).',
    strict: true,
    value: {
        '$schema': 'http://json-schema.org/draft-04/schema#',
        'type': 'object',
        'properties': {
            'analysis_type': {
                'type': 'string',
                'enum': ['individual_prompt'],
            },
            'prompt_name': { 'type': 'string' },
            'prompt_identifier': { 'type': ['string', 'number'] },
            'original_token_count': { 'type': 'integer' },
            'issues': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'type': {
                            'type': 'string',
                            'enum': ['internal_verbosity', 'vague_unactionable', 'internal_self_contradiction', 'dead_weight', 'structural_disorganization', 'counterproductive_priming', 'low_value_thinking_step', 'missing_critical_step', 'granularity_mismatch', 'model_incompatible_structure'],
                        },
                        'severity': {
                            'type': 'string',
                            'enum': ['high', 'medium', 'low'],
                        },
                        'passage': { 'type': 'string' },
                        'explanation': { 'type': 'string' },
                        'suggested_rewrite': { 'type': 'string' },
                    },
                    'required': ['type', 'severity', 'passage', 'explanation', 'suggested_rewrite'],
                },
            },
        },
        'required': ['analysis_type', 'prompt_name', 'prompt_identifier', 'original_token_count', 'issues'],
    },
};

export const INDIVIDUAL_REWRITE_SCHEMA = {
    name: 'IndividualPromptRewrite',
    description: 'Schema for individual prompt full rewrite generation.',
    strict: true,
    value: {
        '$schema': 'http://json-schema.org/draft-04/schema#',
        'type': 'object',
        'properties': {
            'suggested_full_rewrite': {
                'type': 'object',
                'properties': {
                    'text': { 'type': 'string' },
                    'assumptions': {
                        'type': 'array',
                        'items': { 'type': 'string' },
                    },
                    'rewrite_token_count': { 'type': 'integer' },
                    'estimated_tokens_saved': { 'type': 'integer' },
                },
                'required': ['text', 'assumptions', 'rewrite_token_count', 'estimated_tokens_saved'],
            },
        },
        'required': ['suggested_full_rewrite'],
    },
};

export const FOLLOWUP_SCHEMA = {
    name: 'CrossPromptFollowUp',
    description: 'Schema for targeted cross-prompt follow-up analysis.',
    strict: true,
    value: {
        '$schema': 'http://json-schema.org/draft-04/schema#',
        'type': 'object',
        'properties': {
            'analysis_type': {
                'type': 'string',
                'enum': ['cross_prompt_followup'],
            },
            'original_issue_summary': { 'type': 'string' },
            'involved_prompts': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'prompt_name': { 'type': 'string' },
                        'prompt_identifier': { 'type': ['string', 'number'] },
                        'full_text': { 'type': 'string' },
                    },
                    'required': ['prompt_name', 'prompt_identifier', 'full_text'],
                },
            },
            'detailed_analysis': { 'type': 'string' },
            'recommendation': {
                'type': 'string',
                'enum': ['consolidate', 'keep_both', 'disable_one', 'rewrite'],
            },
            'recommendation_detail': { 'type': 'string' },
        },
        'required': ['analysis_type', 'original_issue_summary', 'involved_prompts', 'detailed_analysis', 'recommendation', 'recommendation_detail'],
    },
};
