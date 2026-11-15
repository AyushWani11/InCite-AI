// Turns the model's text into safe HTML: markdown (marked), LaTeX math
// (KaTeX), then sanitised (DOMPurify), because the text comes from a model
// that has read user-supplied documents.
//
// Gemini writes formulas in LaTeX: $...$ or \(...\) inline, and $$...$$ or
// \[...\] on their own. Without this they showed up as raw "$\mu_E$".
import { Marked, type TokenizerAndRendererExtension } from 'marked';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// throwOnError: false shows invalid LaTeX in red instead of failing.
// htmlAndMathml: the visible HTML plus MathML that screen readers read.
const tex = (source: string, displayMode: boolean) =>
	katex.renderToString(source, { displayMode, throwOnError: false, output: 'htmlAndMathml' });

// Inline rules, tried in order. Single $ follows Pandoc's rule so prices
// aren't mistaken for math: the opening $ must be followed by a non-space,
// the closing $ preceded by a non-space and not followed by a digit
// ("it costs $5 and $10" stays text).
const INLINE_RULES: Array<[RegExp, boolean]> = [
	[/^\$\$(?!\$)([\s\S]+?)\$\$/, true],
	// The content may not contain a backtick or an escaped \$, so math never
	// runs into inline code or a literal dollar ("$10 ... `$x$`" stays text).
	// The last unit may be an escape, as in $6\%$.
	[/^\$(?=\S)((?:\\[^$]|[^\\$\n`])*?(?:\\[^$]|[^\s\\$`]))\$(?!\d)/, false],
	[/^\\\(([\s\S]+?)\\\)/, false],
	[/^\\\[([\s\S]+?)\\\]/, true],
];

const inlineMath: TokenizerAndRendererExtension = {
	name: 'inlineMath',
	level: 'inline',
	// Where math could start; an escaped \$ is a literal dollar sign.
	start: (src) => src.match(/(?<!\\)\$|\\[([]/)?.index,
	tokenizer(src) {
		for (const [rule, display] of INLINE_RULES) {
			const match = rule.exec(src);
			if (match) return { type: 'inlineMath', raw: match[0], text: match[1].trim(), display };
		}
		return undefined;
	},
	renderer: (token) => tex(token.text, token.display),
};

// $$ ... $$ or \[ ... \] as a block of its own (may span several lines).
const blockMath: TokenizerAndRendererExtension = {
	name: 'blockMath',
	level: 'block',
	start: (src) => src.match(/^ {0,3}(?:\$\$|\\\[)/m)?.index,
	tokenizer(src) {
		const match =
			/^ {0,3}\$\$([\s\S]+?)\$\$ *(?:\n+|$)/.exec(src) ?? /^ {0,3}\\\[([\s\S]+?)\\\] *(?:\n+|$)/.exec(src);
		if (match) return { type: 'blockMath', raw: match[0], text: match[1].trim() };
		return undefined;
	},
	renderer: (token) => `<div class="math-display">${tex(token.text, true)}</div>`,
};

const md = new Marked({ extensions: [blockMath, inlineMath] });

// KaTeX's MathML wraps the formula in <semantics> with the LaTeX source in an
// <annotation>. DOMPurify removes those two tags by default but keeps their
// text, which would put the raw LaTeX back on screen, so allow them.
//
// No images or media: a malicious PDF could get the model to write an image
// whose URL carries the conversation, and the browser would send it to that
// server just by showing the answer. For the same reason, inline styles (which
// KaTeX needs for sizing) may not load anything with url(...).
const PURIFY = {
	ADD_TAGS: ['semantics', 'annotation'],
	FORBID_TAGS: ['img', 'picture', 'source', 'video', 'audio', 'track', 'image', 'style'],
};
DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
	if (data.attrName === 'style' && /url\s*\(|@import|expression\s*\(/i.test(data.attrValue)) {
		data.keepAttr = false;
	}
});

export const renderMarkdown = (text: string) =>
	DOMPurify.sanitize(md.parse(text, { async: false }) as string, PURIFY);

// For short text inside an existing element (no paragraph wrapper).
export const renderInlineMarkdown = (text: string) =>
	DOMPurify.sanitize(md.parseInline(text, { async: false }) as string, PURIFY);
