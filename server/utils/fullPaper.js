// Summaries and assessments that see the whole paper.
//
// Gemini 3.6 Flash accepts about 1M input tokens per request, so a normal
// paper (tens of thousands of characters) is sent whole, in ONE request.
// Only a document longer than SUMMARY_FULL_TEXT_MAX_CHARS (default 400,000
// characters, ~100k tokens) is handled with map-reduce:
//   map:    split it at paragraph boundaries into segments and take notes on
//           each one (at most MAX_SEGMENTS calls, PARALLEL_CALLS at a time);
//   reduce: write the final structured result from those notes.
// Worst case per request: 8 note calls + 1 final call (+1 retry of it).
const { generateText } = require('./llm');
const { generateStructured } = require('./structured');
const { splitLongPiece } = require('./chunking');

const SEGMENT_CHARS = 24000; // ~6k tokens per note-taking call
const MAX_SEGMENTS = 8; // cap on note-taking calls per request
const PARALLEL_CALLS = 3; // note-taking calls in flight at once

function fullTextMaxChars() {
	return Number(process.env.SUMMARY_FULL_TEXT_MAX_CHARS) || 400000;
}

// Greedily pack paragraphs (blank-line separated; very long ones split by
// line, then at spaces) into segments of at most maxChars.
function packSegments(text, maxChars) {
	const pieces = text
		.split(/\n\s*\n/)
		.flatMap((para) => (para.length <= maxChars ? [para] : para.split('\n')))
		.flatMap((piece) => (piece.length <= maxChars ? [piece] : splitLongPiece(piece, maxChars)))
		.map((piece) => piece.trim())
		.filter(Boolean);

	const segments = [];
	let current = '';
	for (const piece of pieces) {
		if (current && current.length + 2 + piece.length > maxChars) {
			segments.push(current);
			current = piece;
		} else {
			current = current ? `${current}\n\n${piece}` : piece;
		}
	}
	if (current) segments.push(current);
	return segments;
}

/**
 * Split text into at most `maxSegments` segments at paragraph boundaries.
 * Segments start at `segmentChars` and grow when needed to respect the cap,
 * so no text is ever dropped.
 */
function splitIntoSegments(text, segmentChars = SEGMENT_CHARS, maxSegments = MAX_SEGMENTS) {
	let size = Math.max(segmentChars, Math.ceil(text.length / maxSegments));
	let segments = packSegments(text, size);
	while (segments.length > maxSegments) {
		size = Math.ceil(size * 1.25);
		segments = packSegments(text, size);
	}
	return segments;
}

// Run fn over items with at most `limit` calls in flight; keeps order.
async function mapWithLimit(items, limit, fn) {
	const results = new Array(items.length);
	let next = 0;
	async function worker() {
		while (next < items.length) {
			const i = next++;
			results[i] = await fn(items[i], i);
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

/**
 * Produce a validated structured result (see utils/structured.js) from a
 * whole paper. `prompts` supplies:
 *   whole(text)               the single-request prompt
 *   segment(text, i, total)   note-taking prompt for part i of total
 *   combine(notes)            final prompt from the notes (an array)
 */
async function generateFromFullPaper({ text, schema, label, prompts }) {
	if (text.length <= fullTextMaxChars()) {
		return generateStructured({ prompt: prompts.whole(text), schema, label });
	}
	const segments = splitIntoSegments(text);
	console.log(`${label}: ${text.length} characters, map-reduce over ${segments.length} segments`);
	const notes = await mapWithLimit(segments, PARALLEL_CALLS, (segment, i) =>
		generateText(prompts.segment(segment, i + 1, segments.length))
	);
	return generateStructured({ prompt: prompts.combine(notes), schema, label });
}

module.exports = {
	generateFromFullPaper,
	splitIntoSegments,
	mapWithLimit,
	fullTextMaxChars,
	SEGMENT_CHARS,
	MAX_SEGMENTS,
	PARALLEL_CALLS,
};
