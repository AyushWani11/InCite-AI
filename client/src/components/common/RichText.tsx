import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { renderMarkdown, renderInlineMarkdown } from '../../utils/markdown';

interface RichTextProps {
	text: string;
	// Inline: for a list item or a short line (no paragraph spacing).
	inline?: boolean;
	className?: string;
}

// Text written by the model (markdown with LaTeX math), shown as sanitised
// HTML. See utils/markdown.ts.
const RichText: React.FC<RichTextProps> = ({ text, inline = false, className }) => {
	const html = useMemo(() => (inline ? renderInlineMarkdown(text) : renderMarkdown(text)), [text, inline]);
	if (inline) return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
	return (
		<div
			className={clsx(
				'prose prose-gray max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:mt-4 prose-headings:mb-2 prose-a:text-teal-700 [&>:first-child]:mt-0 [&>:last-child]:mb-0',
				className
			)}
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
};

export default RichText;
