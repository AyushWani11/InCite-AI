const { test } = require('node:test');
const assert = require('node:assert/strict');
const { splitIntoChunks } = require('../utils/chunking');

const words = (s) => s.split(/\s+/).filter(Boolean);
const sentencesOf = (chunk) => chunk.split(/(?<=[.?!])\s+(?=[A-Z])/);

// Numbered sentences of varying length, so order and overlap can be checked.
const numbered = (n, filler = 'about glaciers and climate') =>
	Array.from({ length: n }, (_, i) => `Sentence ${i} is ${filler.repeat(1 + (i % 4))}.`);

test('sentences are grouped into chunks of at most 400 characters', () => {
	const chunks = splitIntoChunks(numbered(60).join(' '));
	assert.ok(chunks.length > 1);
	for (const c of chunks) assert.ok(c.length <= 400, `chunk of ${c.length} chars`);
});

test('each chunk starts with the last sentence of the previous one', () => {
	const chunks = splitIntoChunks(numbered(60).join(' '));
	for (let i = 1; i < chunks.length; i++) {
		const overlap = sentencesOf(chunks[i - 1]).at(-1);
		assert.ok(chunks[i].startsWith(overlap), `chunk ${i} does not repeat "${overlap}"`);
	}
});

test('with the overlap removed, every sentence appears once and in order', () => {
	const sentences = numbered(60);
	const chunks = splitIntoChunks(sentences.join(' '));
	const rebuilt = chunks.flatMap((c, i) => sentencesOf(c).slice(i === 0 ? 0 : 1));
	assert.deepEqual(rebuilt, sentences);
});

test('the overlap is skipped when it would push a chunk over the limit', () => {
	const long = 'word '.repeat(70).trim(); // ~350 characters
	const sentences = Array.from({ length: 6 }, (_, i) => `Long sentence ${i} ${long}.`);
	const chunks = splitIntoChunks(sentences.join(' '));
	for (const c of chunks) assert.ok(c.length <= 400, `chunk of ${c.length} chars`);
	assert.equal(chunks.length, 6); // one sentence each, nothing repeated
});

test('a long run with no sentence breaks is still split to the limit', () => {
	// e.g. a reference list or table: periods followed by digits or lowercase
	const refs = Array(120).fill('smith j. et al. 2020. nature 12:34-56.').join(' ');
	const chunks = splitIntoChunks(refs);
	for (const c of chunks) assert.ok(c.length <= 400, `chunk of ${c.length} chars`);
	assert.deepEqual(words(chunks.join(' ')), words(refs));
});

test('a single "word" longer than the limit is cut, not dropped', () => {
	const blob = 'x'.repeat(1000);
	const chunks = splitIntoChunks(`Intro. ${blob} End.`);
	for (const c of chunks) assert.ok(c.length <= 400, `chunk of ${c.length} chars`);
	assert.equal(chunks.join('').replace(/\s/g, '').length, `Intro.${blob}End.`.length);
});

test('no empty chunks, and empty input gives none', () => {
	assert.deepEqual(splitIntoChunks(''), []);
	assert.deepEqual(splitIntoChunks('   \n  '), []);
	assert.ok(splitIntoChunks('One. Two. Three.').every((c) => c.trim().length > 0));
});
