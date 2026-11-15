// Prompts for the structured AI features. They describe the task; the
// field-by-field format comes from the JSON schemas in utils/schemas.js,
// which Gemini is made to follow.

// Author/keyword extraction at upload reads only the start of the paper on
// purpose: it runs on every upload, so it must be fast and cheap, and the
// title, abstract and introduction carry the key terms.
const KEYWORD_TEXT_CHARS = 6000;

const buildMetadataPrompt = (text) => `
You are an academic assistant. From the research paper text below, extract
the author names and 5 to 10 keywords that summarise the paper.

Text:
${text.substring(0, KEYWORD_TEXT_CHARS)}
`;

// Summaries and assessments read the WHOLE paper (see utils/fullPaper.js):
// one request normally ("whole"); for very long documents, notes on each
// part first ("segment"), then a final answer from those notes ("combine").
const formatNotes = (notes) => notes.map((n, i) => `Notes on part ${i + 1}:\n${n}`).join('\n\n');

const SUMMARY_TASK = `You are an expert academic summarizer. Write a structured summary of the
research paper that captures both depth and clarity.`;

const summaryPrompts = {
	whole: (text) => `${SUMMARY_TASK}

Text:
${text}
`,
	segment: (text, i, total) => `You are reading part ${i} of ${total} of a research paper. Take detailed
notes on this part only: contributions, methods, datasets, results (keep the
numbers), limitations and conclusions it contains. Write notes, not a summary
of the whole paper.

Part ${i} of ${total}:
${text}
`,
	combine: (notes) => `${SUMMARY_TASK} You are given notes taken on each part of
the paper, in order; base the summary on all of them.

${formatNotes(notes)}
`,
};

const ASSESSMENT_TASK = `You are an academic research paper reviewer who focuses on content. Assume
none of the figures are missing. Rate the writing quality, methodology and
academic standards, give feedback on each, list actionable improvement
suggestions and any issues (citation gaps, statistical problems, ...), and
describe the paper's X-factor. The overall score (0-100) should be a fair
reflection of the three ratings.`;

const assessmentPrompts = {
	whole: (text) => `${ASSESSMENT_TASK}

Text:
${text}
`,
	segment: (text, i, total) => `You are reviewing part ${i} of ${total} of a research paper. Take reviewer
notes on this part only: writing quality, soundness of methods and
experiments, citations and formatting, concrete issues, and anything
original. Write notes, not the final review.

Part ${i} of ${total}:
${text}
`,
	combine: (notes) => `${ASSESSMENT_TASK} You are given reviewer notes taken on
each part of the paper, in order; base the review on all of them.

${formatNotes(notes)}
`,
};

module.exports = {
	buildMetadataPrompt,
	summaryPrompts,
	assessmentPrompts,
	KEYWORD_TEXT_CHARS,
	SUMMARY_TASK,
};
