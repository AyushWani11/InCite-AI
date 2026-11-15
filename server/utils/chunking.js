// Splits a paper's text into chunks for embedding: whole sentences grouped
// together, at most `maxChunkSize` characters each, with one sentence of
// overlap between consecutive chunks.
//
// Sentences are found by ". " / "? " / "! " followed by a capital letter.
// Reference lists, tables and equations often have no such break, so any
// piece still longer than the limit is cut at the last space before it (or
// mid-word, if there is no space). The embedding model has an input limit,
// and a huge chunk would also dilute what it is about.
function splitLongPiece(piece, maxChunkSize) {
	const parts = [];
	let rest = piece.trim();
	while (rest.length > maxChunkSize) {
		let cut = rest.lastIndexOf(' ', maxChunkSize);
		if (cut <= 0) cut = maxChunkSize;
		parts.push(rest.slice(0, cut).trim());
		rest = rest.slice(cut).trim();
	}
	if (rest) parts.push(rest);
	return parts;
}

function splitIntoChunks(text, maxChunkSize = 400) {
	const pieces = text
		.split(/(?<=[.?!])\s+(?=[A-Z])/)
		.flatMap((sentence) => splitLongPiece(sentence, maxChunkSize));

	// One sentence of overlap: each new chunk starts with the previous chunk's
	// last sentence (when both fit within the limit), so a statement that
	// straddles a boundary is still found whole in at least one chunk.
	const chunks = [];
	let current = []; // pieces of the chunk being built
	let currentLength = 0;
	for (const piece of pieces) {
		const joinedLength = current.length ? currentLength + 1 + piece.length : piece.length;
		if (current.length && joinedLength > maxChunkSize) {
			chunks.push(current.join(' '));
			const overlap = current[current.length - 1];
			const withOverlap = overlap.length + 1 + piece.length;
			current = withOverlap <= maxChunkSize ? [overlap, piece] : [piece];
			currentLength = withOverlap <= maxChunkSize ? withOverlap : piece.length;
		} else {
			current.push(piece);
			currentLength = joinedLength;
		}
	}
	if (current.length) chunks.push(current.join(' '));
	return chunks;
}

module.exports = { splitIntoChunks, splitLongPiece };
