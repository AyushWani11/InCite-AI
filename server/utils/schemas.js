// JSON Schemas for Gemini's structured output. Each one is sent to Gemini
// (responseJsonSchema) and used to validate the reply (utils/structured.js).
// Field names match what the client renders (PaperViewer.tsx).
//
// minLength is not enforced by Gemini, only by our validator: it turns an
// empty "findings": "" into a retry instead of a blank section in the UI.

const text = (description) => ({ type: 'string', minLength: 1, description });
const list = (description, extra = {}) => ({
	type: 'array',
	items: { type: 'string', minLength: 1 },
	description,
	...extra,
});

const SUMMARY_SCHEMA = {
	type: 'object',
	properties: {
		summary: text('Concise, well-written abstract of the paper.'),
		contributions: list('Each item is one novel or impactful contribution, stated clearly.', {
			minItems: 1,
		}),
		methodology: text(
			'The techniques, models or frameworks used, in detail: datasets, architecture, mathematical tools where relevant.'
		),
		findings: text('The concrete results, with comparisons, metrics or evidence for the claims.'),
		conclusion: text('The takeaway of the paper and the future work it enables.'),
	},
	required: ['summary', 'contributions', 'methodology', 'findings', 'conclusion'],
	propertyOrdering: ['summary', 'contributions', 'methodology', 'findings', 'conclusion'],
};

const RATINGS = ['Excellent', 'Good', 'Average', 'Poor'];
const rating = (description) => ({ type: 'string', enum: RATINGS, description });

const ASSESSMENT_SCHEMA = {
	type: 'object',
	properties: {
		score: {
			type: 'object',
			properties: {
				writingQuality: rating('Clarity, grammar, organisation and tone.'),
				methodology: rating('Soundness of methods and experiments.'),
				academicStandards: rating('Formatting, citations, references and compliance.'),
				overallScore: {
					type: 'integer',
					minimum: 0,
					maximum: 100,
					description: 'Fair overall score from 0 to 100, consistent with the three ratings.',
				},
			},
			required: ['writingQuality', 'methodology', 'academicStandards', 'overallScore'],
			propertyOrdering: ['writingQuality', 'methodology', 'academicStandards', 'overallScore'],
		},
		feedback: {
			type: 'object',
			properties: {
				writing: text('Comments on clarity, grammar, organisation and tone.'),
				methodology: text('Comments on methods, experiments and limitations.'),
				standards: text('Comments on formatting, citations, references and compliance.'),
			},
			required: ['writing', 'methodology', 'standards'],
			propertyOrdering: ['writing', 'methodology', 'standards'],
		},
		improvementSuggestions: list('Specific, actionable recommendations.'),
		issues: list('Problems such as citation gaps or statistical issues. Empty if none.'),
		'X-Factor': text('What is unique, creative or impactful about the research.'),
	},
	required: ['score', 'feedback', 'improvementSuggestions', 'issues', 'X-Factor'],
	propertyOrdering: ['score', 'feedback', 'improvementSuggestions', 'issues', 'X-Factor'],
};

const METADATA_SCHEMA = {
	type: 'object',
	properties: {
		authors: list('Author names as written in the paper. Empty if none are given.'),
		keywords: list('5 to 10 keywords that summarise the paper.', { maxItems: 10 }),
	},
	required: ['authors', 'keywords'],
	propertyOrdering: ['authors', 'keywords'],
};

module.exports = { SUMMARY_SCHEMA, ASSESSMENT_SCHEMA, METADATA_SCHEMA, RATINGS };
