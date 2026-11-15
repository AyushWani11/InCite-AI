// Builds small but valid PDF files in memory, so tests exercise the real
// pdf-parse library instead of a mock.

function escapeText(s) {
	return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * @param {object} opts
 * @param {string[][]} opts.pages  Lines of text for each page.
 * @param {string} [opts.title]    Embedded /Title metadata (optional).
 * @returns {Buffer}
 */
function makePdf({ pages, title } = {}) {
	if (!pages || pages.length === 0) pages = [['Empty test document.']];

	// Object numbers: 1 catalog, 2 page tree, 3 font, then a (page, content)
	// pair per page, then an optional info dictionary.
	const bodies = [];
	const pageRefs = pages.map((_, k) => `${4 + 2 * k} 0 R`);
	bodies.push('<< /Type /Catalog /Pages 2 0 R >>');
	bodies.push(`<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>`);
	bodies.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

	pages.forEach((lines, k) => {
		const contentNum = 5 + 2 * k;
		bodies.push(
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
				`/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNum} 0 R >>`
		);
		const stream =
			'BT /F1 10 Tf 12 TL 50 750 Td\n' +
			lines.map((l) => `(${escapeText(l)}) Tj T*`).join('\n') +
			'\nET';
		bodies.push(
			`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`
		);
	});

	let infoNum = null;
	if (title) {
		bodies.push(`<< /Title (${escapeText(title)}) /Producer (InCite tests) >>`);
		infoNum = bodies.length;
	}

	// Pad with PDF comment lines to ~40 KB, a realistic minimum for a paper.
	// pdf-parse bundles pdf.js 1.10, which assumes its data starts at offset 0
	// of the underlying memory. Node copies buffers smaller than half of
	// Buffer.poolSize (32 KB on Node 26, 4 KB before) into a shared pool at a
	// varying offset, so smaller PDFs fail to parse at random.
	let out = '%PDF-1.4\n' + `%${'-'.repeat(76)}\n`.repeat(520);
	const offsets = [];
	bodies.forEach((body, i) => {
		offsets.push(Buffer.byteLength(out, 'latin1'));
		out += `${i + 1} 0 obj\n${body}\nendobj\n`;
	});

	const xrefAt = Buffer.byteLength(out, 'latin1');
	out += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
	for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
	out +=
		`trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R` +
		(infoNum ? ` /Info ${infoNum} 0 R` : '') +
		` >>\nstartxref\n${xrefAt}\n%%EOF\n`;

	return Buffer.from(out, 'latin1');
}

module.exports = { makePdf };
