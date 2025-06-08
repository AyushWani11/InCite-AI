import React, { useEffect, useRef } from 'react';
import Prism from 'prismjs';
import ClipboardJS from 'clipboard';
import 'prismjs/themes/prism-tomorrow.css';
import './Codeblock.css';

interface CodeBlockProps {
	code: string;
	language: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
	const codeRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		// Highlight code
		Prism.highlightAll();

		// Setup Clipboard
		const clipboard = new ClipboardJS('.copy-btn', {
			target: () => codeRef.current as Element,
		});

		return () => {
			clipboard.destroy();
		};
	}, [code, language]);

	return (
		<div className='code-block'>
			<pre>
				<code
					ref={codeRef}
					className={`language-${language}`}
					id='code-snippet'
				>
					{code}
				</code>
			</pre>
			<button className='copy-btn' data-clipboard-target='#code-snippet'>
				Copy
			</button>
		</div>
	);
};

export default CodeBlock;
