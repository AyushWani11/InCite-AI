const { test } = require('node:test');
const assert = require('node:assert/strict');
const { splitIntoChunks } = require('../utils/chunking');

const words = (s) => s.split(/\s+/).filter(Boolean);

test('sentences are grouped into chunks of at most 400 characters', () => {
	const sentence = 'This is a normal sentence about glaciers and climate.';
	const text = Array(40).fill(sentence).join(' ');
	const chunks = splitIntoChunks(text);
	assert.ok(chunks.length > 1);
	for (const c of chunks) assert.ok(c.length <= 400, `chunk of ${c.length} chars`);
	assert.deepEqual(words(chunks.join(' ')), words(text), 'text was lost or changed');
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
