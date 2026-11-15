import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
	MessageCircle,
	Send,
	Paperclip,
	Loader2,
	Mic,
	MicOff,
	Volume2,
	VolumeX,
	X,
	FileText,
	AlertCircle,
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { clsx } from 'clsx';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import CodeBlock from '../common/CodeBlock';
import { API_BASE_URL as backendUrl } from '../../config';
import { NETWORK_ERROR, readError } from '../../utils/http';

interface Paper {
	_id: string;
	title: string;
	authors?: string[];
}

// Where an answer came from (sent by the server in the X-Sources header).
interface Source {
	paperId?: string;
	title: string;
	scope: string; // 'excerpts' | 'full text' | 'attached file' | ...
	excerpts?: number[]; // chunk positions within the paper, from 0
}

interface Message {
	id: number;
	type: 'user' | 'assistant';
	content: string;
	isStreaming?: boolean;
	sources?: Source[];
	// A failed question and its error reply: shown, but not sent back to the
	// model as conversation history.
	isError?: boolean;
}

interface ChatInterfaceProps {
	selectedPaper: Paper | null;
}

// Files the server can read when attached to a question: PDFs, and plain
// text read as UTF-8. Checked by extension, because browsers report types
// inconsistently (Windows calls .csv "application/vnd.ms-excel").
const ATTACHMENT_TYPES = ['pdf', 'txt', 'md', 'csv', 'json'];
const MAX_ATTACHMENT_MB = 20;

const PAPER_SUGGESTIONS = [
	'Summarize this paper in a few sentences',
	'What are the main contributions?',
	'What methods and data did the authors use?',
	'What are the limitations?',
];

class ChatError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const describeError = (err: unknown) => {
	if (err instanceof ChatError) {
		if (err.status === 401) return 'Your session has expired. Please log in again.';
		// The server says what went wrong (e.g. "Paper not found.").
		return err.message
			? `Sorry, I couldn't answer that: ${err.message}`
			: 'Sorry, something went wrong while answering. Please try again.';
	}
	return NETWORK_ERROR;
};

// The header holds URL-encoded JSON; anything unexpected means "no sources".
const parseSources = (header: string | null): Source[] => {
	if (!header) return [];
	try {
		const parsed = JSON.parse(decodeURIComponent(header));
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

// Sends the question and passes each piece of the answer to onText as soon as
// it arrives. Resolves with the answer's sources.
async function streamAnswer(form: FormData, onText: (text: string) => void): Promise<Source[]> {
	const res = await fetch(`${backendUrl}/chat`, { method: 'POST', body: form, credentials: 'include' });
	if (!res.ok) throw new ChatError(res.status, await readError(res, ''));

	const sources = parseSources(res.headers.get('X-Sources'));
	const reader = res.body?.getReader();
	if (reader) {
		const decoder = new TextDecoder();
		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;
			onText(decoder.decode(value, { stream: true }));
		}
		const rest = decoder.decode();
		if (rest) onText(rest);
	}
	return sources;
}

// Splits an answer into markdown text and fenced code blocks.
const splitCodeBlocks = (text: string) => {
	const fence = /```(\w+)?\n([\s\S]*?)```/g;
	const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
	let last = 0;
	let match: RegExpExecArray | null;
	while ((match = fence.exec(text)) !== null) {
		if (match.index > last) parts.push({ type: 'text', content: text.slice(last, match.index) });
		parts.push({ type: 'code', content: match[2], language: match[1] || 'text' });
		last = fence.lastIndex;
	}
	if (last < text.length) parts.push({ type: 'text', content: text.slice(last) });
	return parts;
};

// The model's markdown, rendered as HTML. Sanitized, because the text comes
// from an AI model that has read user-supplied documents.
const Markdown: React.FC<{ text: string }> = ({ text }) => {
	const html = useMemo(() => DOMPurify.sanitize(marked.parse(text, { async: false }) as string), [text]);
	return (
		<div
			className='prose prose-sm prose-gray max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:mt-4 prose-headings:mb-2 prose-a:text-teal-700'
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
};

const formatSource = (source: Source) =>
	source.scope === 'excerpts' && source.excerpts?.length
		? `${source.title} (excerpts ${source.excerpts.map((n) => n + 1).join(', ')})`
		: `${source.title} (${source.scope})`;

const toHistory = (messages: Message[]) =>
	messages
		.filter((m) => !m.isError && !m.isStreaming)
		.map((m) => ({ role: m.type === 'user' ? 'user' : 'assistant', text: m.content }))
		// The model expects turns to alternate, starting with the user.
		.filter((m, i, all) => (i === 0 ? m.role === 'user' : all[i - 1].role !== m.role));

const iconButton =
	'h-11 w-11 shrink-0 rounded-xl flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';

const ChatInterface: React.FC<ChatInterfaceProps> = ({ selectedPaper }) => {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [attachment, setAttachment] = useState<File | null>(null);
	const [attachmentError, setAttachmentError] = useState('');
	const [readAloud, setReadAloud] = useState(false);

	const listRef = useRef<HTMLDivElement>(null);
	const stickToBottom = useRef(true);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const nextId = useRef(1);
	const messagesRef = useRef(messages);
	messagesRef.current = messages;
	const hintId = useId();

	const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();
	const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

	// Follow the answer as it streams in, unless the user has scrolled up to
	// read something earlier.
	useEffect(() => {
		const list = listRef.current;
		if (list && stickToBottom.current) list.scrollTop = list.scrollHeight;
	}, [messages]);

	const handleScroll = () => {
		const list = listRef.current;
		if (list) stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
	};

	// Show what is being dictated while the microphone is on.
	useEffect(() => {
		if (listening) setInput(transcript);
	}, [listening, transcript]);

	// Save the conversation when the page is closed.
	useEffect(() => {
		const save = () => {
			const history = toHistory(messagesRef.current);
			if (history.length === 0) return;
			fetch(`${backendUrl}/chat/save-history`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ history }),
				keepalive: true,
			}).catch(() => {});
		};
		window.addEventListener('beforeunload', save);
		return () => window.removeEventListener('beforeunload', save);
	}, []);

	const resizeTextarea = (el: HTMLTextAreaElement) => {
		el.style.height = 'auto';
		el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
	};

	const updateMessage = (id: number, changes: Partial<Message>) =>
		setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)));

	const speak = (text: string) => {
		const synth = window.speechSynthesis;
		const utterance = new SpeechSynthesisUtterance(text.replace(/[*_#`>]+/g, ''));
		utterance.voice = synth.getVoices().find((v) => v.lang === 'en-US') || null;
		synth.speak(utterance);
	};

	const send = async (text: string) => {
		const question = text.trim();
		if (!question || isLoading) return;
		if (listening) {
			SpeechRecognition.stopListening();
			resetTranscript();
		}

		const form = new FormData();
		form.append('question', question);
		form.append('history', JSON.stringify(toHistory(messages)));
		// An attached file takes priority; otherwise the selected paper's
		// database id (titles are not unique). With neither, the server picks
		// the most relevant of the user's papers.
		if (attachment) form.append('file', attachment);
		else if (selectedPaper) form.append('paperId', selectedPaper._id);

		const questionId = nextId.current++;
		const answerId = nextId.current++;
		setMessages((prev) => [
			...prev,
			{ id: questionId, type: 'user', content: question },
			{ id: answerId, type: 'assistant', content: '', isStreaming: true },
		]);
		setInput('');
		if (textareaRef.current) textareaRef.current.style.height = 'auto';
		stickToBottom.current = true;
		setIsLoading(true);

		let answer = '';
		try {
			const sources = await streamAnswer(form, (piece) => {
				answer += piece;
				updateMessage(answerId, { content: answer });
			});
			updateMessage(answerId, { isStreaming: false, sources });
			if (readAloud && canSpeak && answer.trim()) speak(answer);
			setAttachment(null);
			if (fileInputRef.current) fileInputRef.current.value = '';
		} catch (err) {
			setMessages((prev) => [
				...prev
					.filter((m) => m.id !== answerId)
					.map((m) => (m.id === questionId ? { ...m, isError: true } : m)),
				{ id: nextId.current++, type: 'assistant', content: describeError(err), isError: true },
			]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
		let problem = '';
		if (!ATTACHMENT_TYPES.includes(ext)) problem = 'That file type isn’t supported. Attach a PDF, TXT, MD, CSV or JSON file.';
		else if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) problem = `Files can be at most ${MAX_ATTACHMENT_MB} MB.`;

		setAttachmentError(problem);
		setAttachment(problem ? null : file);
		if (problem && fileInputRef.current) fileInputRef.current.value = '';
	};

	const removeAttachment = () => {
		setAttachment(null);
		setAttachmentError('');
		if (fileInputRef.current) fileInputRef.current.value = '';
	};

	const toggleReadAloud = () => {
		if (readAloud) window.speechSynthesis.cancel();
		setReadAloud((on) => !on);
	};

	const toggleListening = () => {
		if (listening) {
			SpeechRecognition.stopListening();
			resetTranscript();
		} else {
			resetTranscript();
			SpeechRecognition.startListening({ continuous: true });
		}
	};

	const subtitle = attachment
		? `Answering from ${attachment.name}`
		: selectedPaper
			? `About: ${selectedPaper.title}`
			: 'Searching all your papers';
	const placeholder = attachment
		? 'Ask about the attached file…'
		: selectedPaper
			? 'Ask about this paper…'
			: 'Ask about your papers…';
	const canSend = input.trim().length > 0 && !isLoading;

	return (
		<div className='h-full flex flex-col bg-gray-50'>
			{/* Header */}
			<div className='bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3'>
				<div className='flex items-center gap-3 min-w-0'>
					<div className='w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0'>
						<MessageCircle className='w-5 h-5 text-teal-700' aria-hidden='true' />
					</div>
					<div className='min-w-0'>
						<h2 className='text-base font-semibold text-gray-900'>InCite assistant</h2>
						<p className='text-sm text-gray-500 truncate'>{subtitle}</p>
					</div>
				</div>
				{canSpeak && (
					<button
						type='button'
						onClick={toggleReadAloud}
						aria-pressed={readAloud}
						aria-label='Read answers aloud'
						title={readAloud ? 'Reading answers aloud' : 'Read answers aloud'}
						className={clsx(
							'h-10 w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
							readAloud ? 'bg-teal-100 text-teal-800' : 'text-gray-500 hover:bg-gray-100'
						)}
					>
						{readAloud ? <Volume2 className='w-5 h-5' /> : <VolumeX className='w-5 h-5' />}
					</button>
				)}
			</div>

			{/* Conversation */}
			<div
				ref={listRef}
				onScroll={handleScroll}
				role='log'
				aria-label='Conversation'
				aria-busy={isLoading}
				className='flex-1 overflow-y-auto px-4 sm:px-6 py-5'
			>
				{messages.length === 0 ? (
					<div className='min-h-full flex flex-col items-center justify-center text-center py-6'>
						<div className='w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-4'>
							<MessageCircle className='w-6 h-6 text-teal-700' aria-hidden='true' />
						</div>
						<h3 className='text-lg font-semibold text-gray-900'>
							{selectedPaper ? 'Ask about this paper' : 'Ask about your papers'}
						</h3>
						<p className='mt-1 max-w-md text-sm text-gray-600'>
							{selectedPaper
								? `Answers come from “${selectedPaper.title}” and list the passages they used.`
								: 'I’ll find the most relevant of your papers and answer from it. To focus on one paper, select it from your paper list.'}
						</p>
						{selectedPaper && (
							<div className='mt-6 flex flex-wrap justify-center gap-2 max-w-lg'>
								{PAPER_SUGGESTIONS.map((q) => (
									<button
										key={q}
										type='button'
										onClick={() => send(q)}
										disabled={isLoading}
										className='rounded-full border border-teal-200 bg-white px-3 py-1.5 text-sm text-teal-800 hover:bg-teal-50 hover:border-teal-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50'
									>
										{q}
									</button>
								))}
							</div>
						)}
					</div>
				) : (
					<div className='space-y-5'>
						{messages.map((message) =>
							message.type === 'user' ? (
								<div key={message.id} className='flex justify-end'>
									<div
										className={clsx(
											'max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap break-words',
											message.isError ? 'bg-gray-200 text-gray-700' : 'bg-teal-700 text-white'
										)}
									>
										{message.content}
									</div>
								</div>
							) : (
								<div key={message.id} className='flex justify-start'>
									<div
										className={clsx(
											'max-w-[85%] min-w-0 rounded-2xl rounded-bl-md border px-4 py-3 text-sm shadow-sm',
											message.isError ? 'border-red-200 bg-red-50 text-red-800' : 'border-gray-200 bg-white text-gray-800'
										)}
									>
										{message.isError ? (
											<p className='flex items-start gap-2'>
												<AlertCircle className='w-4 h-4 mt-0.5 shrink-0' aria-hidden='true' />
												{message.content}
											</p>
										) : message.isStreaming && !message.content ? (
											<p className='flex items-center gap-2 text-gray-500'>
												<Loader2 className='w-4 h-4 animate-spin text-teal-600' aria-hidden='true' />
												Thinking…
											</p>
										) : (
											splitCodeBlocks(message.content).map((part, i) =>
												part.type === 'code' ? (
													<CodeBlock key={i} code={part.content} language={part.language || 'text'} />
												) : (
													<Markdown key={i} text={part.content} />
												)
											)
										)}

										{!message.isStreaming && message.sources && message.sources.length > 0 && (
											<p className='mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500'>
												<span className='font-medium text-gray-600'>Sources: </span>
												{message.sources.map(formatSource).join('; ')}
											</p>
										)}
									</div>
								</div>
							)
						)}
					</div>
				)}
			</div>

			{/* Composer */}
			<div className='bg-white border-t border-gray-200 px-3 sm:px-6 py-3'>
				{attachmentError && (
					<p role='alert' className='mb-2 text-sm text-red-600'>
						{attachmentError}
					</p>
				)}
				{attachment && (
					<div className='mb-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 py-1.5 pl-3 pr-1 text-sm text-teal-900'>
						<FileText className='w-4 h-4 shrink-0' aria-hidden='true' />
						<span className='truncate'>{attachment.name}</span>
						<span className='shrink-0 text-xs text-teal-700'>
							{(attachment.size / 1024 / 1024).toFixed(1)} MB
						</span>
						<button
							type='button'
							onClick={removeAttachment}
							aria-label={`Remove ${attachment.name}`}
							className='p-1 rounded text-teal-700 hover:bg-teal-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
						>
							<X className='w-4 h-4' />
						</button>
					</div>
				)}

				<div className='flex items-end gap-2'>
					<input
						ref={fileInputRef}
						type='file'
						accept={ATTACHMENT_TYPES.map((t) => `.${t}`).join(',')}
						onChange={handleFileSelect}
						className='hidden'
					/>
					<button
						type='button'
						onClick={() => fileInputRef.current?.click()}
						aria-label='Attach a file to ask about (PDF, TXT, MD, CSV or JSON)'
						title='Attach a file'
						className={clsx(iconButton, attachment ? 'bg-teal-100 text-teal-800' : 'text-gray-500 hover:bg-gray-100')}
					>
						<Paperclip className='w-5 h-5' />
					</button>

					<div className='relative flex-1 min-w-0'>
						<textarea
							ref={textareaRef}
							value={input}
							rows={1}
							onChange={(e) => {
								setInput(e.target.value);
								resizeTextarea(e.target);
							}}
							onKeyDown={(e) => {
								// Enter sends; Shift+Enter adds a line. Ignore Enter while an
								// input method (e.g. for Hindi or Japanese) is composing.
								if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
									e.preventDefault();
									send(input);
								}
							}}
							placeholder={listening ? 'Listening…' : placeholder}
							aria-label='Message'
							aria-describedby={hintId}
							className={clsx(
								'block w-full resize-none rounded-xl border border-gray-300 bg-white py-2.5 pl-4 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent',
								browserSupportsSpeechRecognition ? 'pr-11' : 'pr-4'
							)}
						/>
						{browserSupportsSpeechRecognition && (
							<button
								type='button'
								onClick={toggleListening}
								aria-pressed={listening}
								aria-label='Voice input'
								title={listening ? 'Stop voice input' : 'Voice input'}
								className={clsx(
									'absolute right-1.5 bottom-1.5 h-8 w-8 rounded-lg flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
									listening ? 'text-red-600 bg-red-50 animate-pulse' : 'text-gray-400 hover:text-gray-600'
								)}
							>
								{listening ? <MicOff className='w-4 h-4' /> : <Mic className='w-4 h-4' />}
							</button>
						)}
					</div>

					<button
						type='button'
						onClick={() => send(input)}
						disabled={!canSend}
						aria-label='Send'
						className={clsx(
							iconButton,
							'bg-teal-700 text-white hover:bg-teal-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed'
						)}
					>
						{isLoading ? <Loader2 className='w-5 h-5 animate-spin' /> : <Send className='w-5 h-5' />}
					</button>
				</div>
				<p id={hintId} className='hidden sm:block mt-1.5 text-xs text-gray-500'>
					Enter to send · Shift+Enter for a new line
				</p>
			</div>
		</div>
	);
};

export default ChatInterface;
