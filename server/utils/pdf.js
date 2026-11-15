const pdfParse = require('pdf-parse');

/**
 * Extract text (and metadata) from a PDF. Use this instead of calling
 * pdf-parse directly.
 *
 * pdf-parse bundles pdf.js 1.10 (2017). It copies its input with
 * `new input.constructor(input)` and then assumes the copy starts at the
 * beginning of its memory block. When the input is a Node Buffer, that copy
 * is another Buffer, and Node places small Buffers (under half of
 * Buffer.poolSize: 32 KB on Node 26, 4 KB on older versions) inside a shared
 * memory pool at some offset. pdf.js then reads the wrong bytes: the parse
 * fails, or can even return text from other data in the pool.
 *
 * A plain Uint8Array is always copied into its own memory, so it is safe.
 */
function parsePdf(buffer) {
	return pdfParse(new Uint8Array(buffer));
}

module.exports = { parsePdf };
