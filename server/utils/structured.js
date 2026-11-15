// Getting reliable JSON out of Gemini.
//
// 1. Ask for it properly: JSON mode (responseMimeType) plus a JSON Schema
//    (responseJsonSchema) that the model's output must follow.
// 2. Parse tolerantly: if the reply is wrapped in prose or ``` fences, the
//    JSON inside is still used.
// 3. Validate against the same schema. JSON mode guarantees syntax, not
//    content, and Gemini ignores some keywords (e.g. minLength), so the app
//    checks required fields, types, allowed values and ranges itself.
// 4. Retry once. If the second answer is still unusable, throw
//    StructuredOutputError so the route can answer 502 instead of crashing.
const { generateText } = require('./llm');

class StructuredOutputError extends Error {
	constructor(label, problem) {
		super(`Gemini returned an unusable ${label}: ${problem}`);
		this.name = 'StructuredOutputError';
		this.label = label;
		this.problem = problem;
	}
}

// Returns { ok: true, value } or { ok: false }.
function parseJsonLoose(text) {
	const candidates = [text];
	const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
	if (fenced) candidates.push(fenced[1]);
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));

	for (const candidate of candidates) {
		try {
			const value = JSON.parse(candidate.trim());
			if (value !== null && typeof value === 'object') return { ok: true, value };
		} catch {
			// try the next candidate
		}
	}
	return { ok: false };
}

function typeMatches(value, type) {
	switch (type) {
		case 'object':
			return value !== null && typeof value === 'object' && !Array.isArray(value);
		case 'array':
			return Array.isArray(value);
		case 'string':
			return typeof value === 'string';
		case 'integer':
			return Number.isInteger(value);
		case 'number':
			return typeof value === 'number' && Number.isFinite(value);
		case 'boolean':
			return typeof value === 'boolean';
		default:
			return true;
	}
}

/**
 * Check `value` against the subset of JSON Schema our schemas use: type,
 * properties, required, items, enum, minimum, maximum, minItems, maxItems,
 * minLength. Returns a list of human-readable problems (empty = valid).
 */
function validateAgainstSchema(value, schema, path = '') {
	const here = path || 'the reply';
	if (schema.type && !typeMatches(value, schema.type)) {
		return [`${here} should be ${schema.type === 'array' ? 'a list' : `a ${schema.type}`}`];
	}
	const problems = [];
	if (schema.enum && !schema.enum.includes(value)) {
		problems.push(`${here} is "${value}", expected one of ${schema.enum.join(', ')}`);
	}
	if (typeof value === 'number') {
		if (schema.minimum !== undefined && value < schema.minimum) problems.push(`${here} is below ${schema.minimum}`);
		if (schema.maximum !== undefined && value > schema.maximum) problems.push(`${here} is above ${schema.maximum}`);
	}
	if (typeof value === 'string' && schema.minLength && value.trim().length < schema.minLength) {
		problems.push(`${here} is empty`);
	}
	if (Array.isArray(value)) {
		if (schema.minItems !== undefined && value.length < schema.minItems) problems.push(`${here} has too few items`);
		if (schema.maxItems !== undefined && value.length > schema.maxItems) problems.push(`${here} has too many items`);
		if (schema.items) {
			value.forEach((item, i) => problems.push(...validateAgainstSchema(item, schema.items, `${here}[${i}]`)));
		}
	}
	if (schema.type === 'object') {
		for (const key of schema.required || []) {
			if (value[key] === undefined || value[key] === null) problems.push(`${path ? `${path}.` : ''}${key} is missing`);
		}
		for (const [key, sub] of Object.entries(schema.properties || {})) {
			if (value[key] !== undefined && value[key] !== null) {
				problems.push(...validateAgainstSchema(value[key], sub, path ? `${path}.${key}` : key));
			}
		}
	}
	return problems;
}

/**
 * Ask Gemini for JSON following `schema`; return the validated object.
 * Makes at most two calls. Throws StructuredOutputError if both answers are
 * unusable (other errors, e.g. network or quota, propagate unchanged).
 */
async function generateStructured({ prompt, schema, label }) {
	let problem = '';
	for (let attempt = 1; attempt <= 2; attempt++) {
		const raw = await generateText(prompt, {
			responseMimeType: 'application/json',
			responseJsonSchema: schema,
		});
		const parsed = parseJsonLoose(raw);
		if (!parsed.ok) {
			problem = 'the reply was not valid JSON';
		} else {
			const problems = validateAgainstSchema(parsed.value, schema);
			if (problems.length === 0) return parsed.value;
			problem = problems.slice(0, 5).join('; ');
		}
		console.warn(`Unusable ${label} from Gemini (attempt ${attempt} of 2): ${problem}`);
	}
	throw new StructuredOutputError(label, problem);
}

module.exports = {
	generateStructured,
	StructuredOutputError,
	parseJsonLoose,
	validateAgainstSchema,
};
