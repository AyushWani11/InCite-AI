// Splits a paper's text into chunks for embedding: whole sentences grouped
// together, at most `maxChunkSize` characters each.
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

	const chunks = [];
	let current = '';
	for (const piece of pieces) {
		const joinedLength = current ? current.length + 1 + piece.length : piece.length;
		if (joinedLength > maxChunkSize) {
			chunks.push(current);
			current = piece;
		} else {
			current = current ? `${current} ${piece}` : piece;
		}
	}
	if (current) chunks.push(current);
	return chunks;
}

module.exports = { splitIntoChunks, splitLongPiece };
