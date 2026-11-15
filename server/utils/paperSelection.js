// Which of the user's papers is a question about? Decided by retrieval, not
// by asking the language model to guess from a list of titles.
//
// The question is compared with every chunk of the user's papers (one
// Pinecone search over their namespace). Matches are grouped by paper and
// each paper is scored by the AVERAGE OF ITS 3 BEST CHUNK SCORES, with missing
// chunks counting as 0. That favours a paper with several relevant passages
// over one with a single lucky match. (Trade-off: a very short paper with
// only one or two chunks is at a disadvantage.)
//
// If even the best single chunk scores below the minimum, the question is
// probably not about any of the user's papers, and the app says so instead
// of guessing. The default, 0.25, was calibrated on the real index
// (llama-text-embed-v2, cosine): questions the papers answer had best scores
// of 0.31-0.56; off-topic questions (pizza, football, ...) 0.03-0.17.
// Override with PAPER_MATCH_MIN_SCORE.
const TOP_N = 3;
const DEFAULT_MIN_SCORE = 0.25;

function minScore() {
	const raw = process.env.PAPER_MATCH_MIN_SCORE;
	const value = Number(raw);
	return raw !== undefined && raw !== '' && Number.isFinite(value) ? value : DEFAULT_MIN_SCORE;
}

/**
 * Group matches ({ score, meta: { paperId, title } }) by paper, best first.
 * Each entry: { paperId, title, score, chunks } with chunks best first.
 */
function rankPapers(matches) {
	const byPaper = new Map();
	for (const match of [...matches].sort((a, b) => b.score - a.score)) {
		const id = match.meta.paperId;
		if (!byPaper.has(id)) byPaper.set(id, { paperId: id, title: match.meta.title, chunks: [] });
		byPaper.get(id).chunks.push(match);
	}
	return [...byPaper.values()]
		.map((paper) => ({
			...paper,
			score: paper.chunks.slice(0, TOP_N).reduce((sum, c) => sum + c.score, 0) / TOP_N,
		}))
		.sort((a, b) => b.score - a.score);
}

/**
 * Returns { paper, best, ranked }. `paper` is null when nothing is relevant
 * enough (or there are no matches); `best` is the best single chunk score.
 */
function choosePaper(matches, threshold = minScore()) {
	if (!matches.length) return { paper: null, best: null, ranked: [] };
	const best = Math.max(...matches.map((m) => m.score));
	if (best < threshold) return { paper: null, best, ranked: [] };
	const ranked = rankPapers(matches);
	return { paper: ranked[0], best, ranked };
}

module.exports = { choosePaper, rankPapers, minScore, DEFAULT_MIN_SCORE, TOP_N };
