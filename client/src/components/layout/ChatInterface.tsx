// src/Components/layout/ChatInterface.tsx

import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { marked } from 'marked';
import SpeechRecognition, {
	useSpeechRecognition,
} from 'react-speech-recognition';
import CodeBlock from '../common/CodeBlock';
import { API_BASE_URL as backendUrl } from '../../config';

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
	id: string;
	type: 'user' | 'assistant';
	content: string;
	timestamp: Date;
	isStreaming?: boolean;
	sources?: Source[];
}

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

interface ChatInterfaceProps {
	selectedPaper: Paper | null;
}

// Custom hook for streaming chat with enhanced features
const useEnhancedStreamingChat = () => {
	const [isLoading, setIsLoading] = useState(false);

	const sendMessage = async (
		question: string,
		history: Array<{ role: string; text: string }>,
		file?: File,
		paperId?: string,
		onChunk?: (chunk: string) => void,
		onComplete?: (sources: Source[]) => void
	) => {
		setIsLoading(true);

		try {
			const formData = new FormData();
			formData.append('question', question);

			// Ensure history is always an array
			const safeHistory = Array.isArray(history) ? history : [];
			formData.append('history', JSON.stringify(safeHistory));

			if (file) {
				formData.append('file', file);
			}

			if (paperId && !file) {
				console.log('Sending paperId:', paperId, typeof paperId);
				formData.append('paperId', paperId);

				// Debug FormData contents
				for (let [key, value] of formData.entries()) {
					console.log('FormData entry:', key, value, typeof value);
				}
			}

			const response = await fetch(`${backendUrl}/chat`, {
				method: 'POST',
				body: formData,
				credentials: 'include',
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.error ||
						errorData.msg ||
						`HTTP error! status: ${response.status}`
				);
			}

			const sources = parseSources(response.headers.get('X-Sources'));

			// Rest of your streaming logic remains the same
			const reader = response.body?.getReader();
			const decoder = new TextDecoder();

			if (reader) {
				let done = false;
				while (!done) {
					const { value, done: readerDone } = await reader.read();
					done = readerDone;
					if (value) {
						const chunkText = decoder.decode(value, { stream: true });
						for (let i = 0; i < chunkText.length; i++) {
							await new Promise((resolve) => setTimeout(resolve, 20));
							onChunk?.(chunkText[i]);
						}
					}
				}
			}

			onComplete?.(sources);
		} catch (error) {
			console.error('Chat error:', error);
			throw error;
		} finally {
			setIsLoading(false);
		}
	};

	return { sendMessage, isLoading };
};

// const checkAuthStatus = async () => {
// 	try {
// 		const response = await fetch(`${backendUrl}/auth/verify`, {
// 			method: 'GET',
// 			credentials: 'include',
// 		});
// 		return response.ok;
// 	} catch (error) {
// 		console.error('Auth check failed:', error);
// 		return false;
// 	}
// };

// Helper function to extract code blocks
const extractCodeBlocks = (text: string) => {
	const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
	const parts: Array<{
		type: 'text' | 'code';
		content: string;
		language?: string;
	}> = [];
	let lastIndex = 0;

	let match: RegExpExecArray | null;
	while ((match = codeBlockRegex.exec(text)) !== null) {
		if (match.index > lastIndex) {
			parts.push({
				type: 'text',
				content: text.slice(lastIndex, match.index),
			});
		}
		parts.push({
			type: 'code',
			content: match[2],
			language: match[1] || 'text',
		});
		lastIndex = codeBlockRegex.lastIndex;
	}

	if (lastIndex < text.length) {
		parts.push({ type: 'text', content: text.slice(lastIndex) });
	}

	return parts;
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ selectedPaper }) => {
	const [messages, setMessages] = useState<Message[]>([
		{
			id: '1',
			type: 'assistant',
			content: selectedPaper
				? `Welcome! I'm your AI research assistant. I can help you understand this paper on "${selectedPaper.title}". What would you like to know?`
				: "Welcome! I'm your AI research assistant. I can help you understand research papers. Attach a paper to get started.",
			timestamp: new Date(),
		},
	]);

	const [inputMessage, setInputMessage] = useState('');
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isTTSActive, setIsTTSActive] = useState(false);
	const [error, setError] = useState('');

	// Refs
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const chatHistoryRef = useRef<
		Array<{ role: string; parts: Array<{ text: string }> }>
	>([]);

	// Speech recognition setup
	const {
		transcript,
		listening,
		resetTranscript,
		browserSupportsSpeechRecognition,
	} = useSpeechRecognition();

	const { sendMessage, isLoading } = useEnhancedStreamingChat();

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	// Auto-resize textarea
	const handleTextareaResize = (textarea: HTMLTextAreaElement) => {
		textarea.style.height = 'auto';
		const newHeight = Math.min(textarea.scrollHeight, 120); // Max ~3 lines
		textarea.style.height = `${newHeight}px`;
	};

	// Speech recognition handlers
	const startListening = () => {
		SpeechRecognition.startListening({ continuous: true });
	};

	const stopListening = () => {
		SpeechRecognition.stopListening();
		setInputMessage(transcript);
		resetTranscript();
	};

	// Text-to-speech function
	const speakOutLoud = (text: string) => {
		const synth = window.speechSynthesis;
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.voice =
			synth.getVoices().find((voice) => voice.lang === 'en-US') || null;
		synth.speak(utterance);
	};

	// Enhanced history management
	const pushHistory = (role: string, message: string) => {
		chatHistoryRef.current.push({ role, parts: [{ text: message }] });
	};

	// Convert messages to backend format for history
	// const getHistoryForBackend = () => {
	// 	return chatHistoryRef.current.map((msg) => ({
	// 		role: msg.role === 'user' ? 'user' : 'model',
	// 		text: msg.parts.map((part) => part.text).join(' '),
	// 	}));
	// };

	const handleSendMessage = async () => {
		if (!inputMessage.trim() || isLoading) return;

		// If no paper selected AND no file attached, don't send
		if (!inputMessage.trim() || isLoading) return;

		const trimmedQuestion = inputMessage.trim();

		const userMessage: Message = {
			id: Date.now().toString(),
			type: 'user',
			content: trimmedQuestion,
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMessage]);
		pushHistory('user', trimmedQuestion);

		const assistantMessageId = (Date.now() + 1).toString();
		const streamingMessage: Message = {
			id: assistantMessageId,
			type: 'assistant',
			content: '',
			timestamp: new Date(),
			isStreaming: true,
		};

		setMessages((prev) => [...prev, streamingMessage]);
		setInputMessage('');

		try {
			let accumulatedContent = '';

			// The paper's database id: titles are not unique and may come from
			// the PDF's own metadata, so the server could not find papers by them.
			const paperIdToSend =
				selectedPaper && !selectedFile ? selectedPaper._id : undefined;

			const formattedHistory = messages
				.map((msg) => ({
					role: msg.type === 'user' ? 'user' : 'assistant',
					text: msg.content,
				}))
				.filter((msg, index, arr) => {
					// Remove consecutive messages from same role
					if (index === 0) return msg.role === 'user'; // First must be user
					return arr[index - 1].role !== msg.role; // Ensure alternating
				});

			await sendMessage(
				trimmedQuestion,
				formattedHistory,
				selectedFile || undefined,
				paperIdToSend,
				(char: string) => {
					accumulatedContent += char;
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === assistantMessageId
								? { ...msg, content: accumulatedContent }
								: msg
						)
					);
				},
				(sources) => {
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === assistantMessageId
								? { ...msg, isStreaming: false, sources }
								: msg
						)
					);

					pushHistory('assistant', accumulatedContent);

					if (isTTSActive && accumulatedContent.trim()) {
						speakOutLoud(accumulatedContent);
					}

					setSelectedFile(null);
					if (fileInputRef.current) {
						fileInputRef.current.value = '';
					}
				}
			);
		} catch (error) {
			// Remove the streaming message if there's an error
			setMessages((prev) =>
				prev.filter((msg) => msg.id !== assistantMessageId)
			);

			let errorMessage =
				'Sorry, I encountered an error while processing your question.';
			const reason = (error as Error).message || '';

			if (
				reason.includes('401') ||
				reason.includes('authorization denied') ||
				reason.includes('Token is not valid')
			) {
				errorMessage = 'Your session has expired. Please log in again.';
			} else if (/Failed to fetch|NetworkError/i.test(reason)) {
				errorMessage =
					"Sorry, I couldn't reach the server. Check that it is running (or waking up) and try again.";
			} else if (reason && !/HTTP error/i.test(reason)) {
				// The server says what went wrong (e.g. "Paper not found.",
				// "You have no papers uploaded..."); show it instead of hiding it.
				errorMessage = `Sorry, I couldn't answer that: ${reason}`;
			}

			const errorMsg: Message = {
				id: (Date.now() + 2).toString(),
				type: 'assistant',
				content: errorMessage,
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, errorMsg]);
		}
	};

	// File selection & validation
	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const validTypes = [
			'application/pdf',
			'text/plain',
			'text/csv',
			'application/json',
		];
		const maxSizeInMB = 20;

		if (!validTypes.includes(file.type)) {
			setError(
				'File type not supported. Please upload a PDF, TXT, CSV, or JSON file.'
			);
			setSelectedFile(null);
			if (fileInputRef.current) fileInputRef.current.value = '';
			return;
		}

		if (file.size > maxSizeInMB * 1024 * 1024) {
			setError(`File size should not exceed ${maxSizeInMB} MB.`);
			setSelectedFile(null);
			if (fileInputRef.current) fileInputRef.current.value = '';
			return;
		}

		setSelectedFile(file);
		setError('');
	};

	const handleRemoveFile = () => {
		setSelectedFile(null);
		setError('');
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	const toggleTTS = () => setIsTTSActive((prev) => !prev);

	// Save chat history on page unload
	useEffect(() => {
		const handleBeforeUnload = () => {
			const historyToSave = chatHistoryRef.current;
			if (historyToSave.length > 0) {
				// Convert to the format expected by your backend
				const formattedHistory = historyToSave.map((msg) => ({
					role: msg.role === 'user' ? 'user' : 'assistant',
					text: msg.parts.map((part) => part.text).join(' '),
				}));

				fetch(`${backendUrl}/chat/save-history`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					credentials: 'include', // Include cookies
					body: JSON.stringify({ history: formattedHistory }),
					keepalive: true,
				}).catch(console.error);
			}
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	}, []);

	const suggestedQuestions = selectedPaper
		? [
				'Can you explain the key innovation in this paper compared to previous sequence models?',
				'What are the main contributions of this research?',
				'How does the methodology work in this paper?',
				'What are the experimental results and their significance?',
		  ]
		: [];

	const canSendMessage = inputMessage.trim() && !isLoading;

	return (
		<div className='h-full flex flex-col bg-gray-50'>
			{/* Header */}
			<div className='bg-white border-b border-gray-200 px-6 py-4'>
				<div className='flex items-center justify-between'>
					<div className='flex items-center space-x-3'>
						<div className='w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm'>
							<MessageCircle className='w-5 h-5 text-white' />
						</div>
						<div>
							<h1 className='text-lg font-semibold text-gray-900'>
								Vega - AI Research Assistant
							</h1>
							{selectedPaper
								? `Analyzing: ${selectedPaper.title}`
								: selectedFile
								? `Ready to analyze: ${selectedFile.name}`
								: 'Ask questions about research papers or attach one for specific analysis'}
						</div>
					</div>

					{/* TTS Toggle */}
					<button
						onClick={toggleTTS}
						className={`cursor-pointer h-10 w-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
							isTTSActive
								? 'bg-teal-100 text-teal-700 shadow-sm'
								: 'bg-gray-100 text-gray-500 hover:bg-gray-200'
						}`}
						title={
							isTTSActive ? 'Disable Text-to-Speech' : 'Enable Text-to-Speech'
						}
					>
						{isTTSActive ? (
							<Volume2 className='w-4 h-4' />
						) : (
							<VolumeX className='w-4 h-4' />
						)}
					</button>
				</div>
			</div>

			{/* Messages */}
			<div className='flex-1 overflow-y-auto px-6 py-4 space-y-6'>
				{messages.map((message) => {
					const parts =
						message.type === 'assistant'
							? extractCodeBlocks(message.content)
							: [{ type: 'text' as const, content: message.content }];

					return (
						<div
							key={message.id}
							className={`flex ${
								message.type === 'user' ? 'justify-end' : 'justify-start'
							}`}
						>
							<div
								className={`max-w-xs lg:max-w-2xl px-4 py-3 rounded-2xl shadow-sm ${
									message.type === 'user'
										? 'bg-teal-100 text-teal-900 ml-12'
										: 'bg-white text-gray-800 mr-12'
								}`}
							>
								{parts.map((part, i) =>
									part.type === 'code' ? (
										<CodeBlock
											key={i}
											code={part.content}
											language={part.language || 'text'}
										/>
									) : (
										<div
											key={i}
											className='text-sm leading-relaxed'
											dangerouslySetInnerHTML={{ __html: marked(part.content) }}
										/>
									)
								)}

								{!message.isStreaming && message.sources && message.sources.length > 0 && (
									<div className='mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500'>
										<span className='font-medium'>Sources: </span>
										{message.sources.map((source, i) => (
											<span key={i}>
												{i > 0 && '; '}
												{source.title}
												{source.scope === 'excerpts' && source.excerpts?.length
													? ` (excerpts ${source.excerpts.map((n) => n + 1).join(', ')})`
													: ` (${source.scope})`}
											</span>
										))}
									</div>
								)}

								{message.isStreaming && (
									<div className='flex items-center mt-2 pt-2 border-t border-gray-200'>
										<Loader2 className='w-3 h-3 animate-spin mr-2 text-teal-500' />
										<span className='text-xs text-gray-500'>Thinking...</span>
									</div>
								)}
							</div>
						</div>
					);
				})}
				<div ref={messagesEndRef} />
			</div>

			{/* Suggested Questions */}
			{suggestedQuestions.length > 0 && messages.length <= 1 && (
				<div className='px-6 py-3 bg-teal-50 border-y border-teal-100'>
					<div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
						{suggestedQuestions.slice(0, 4).map((question, index) => (
							<button
								key={index}
								className='text-left bg-white border border-teal-200 rounded-lg p-3 text-sm text-teal-700 hover:bg-teal-50 hover:border-teal-300 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
								onClick={() => setInputMessage(question)}
								disabled={isLoading}
							>
								{question}
							</button>
						))}
					</div>
				</div>
			)}

			{/* File Attachment Display */}
			{selectedFile && (
				<div className='px-6 py-3 bg-blue-50 border-t border-blue-100'>
					<div className='flex items-center justify-between bg-white rounded-lg p-3 border border-blue-200'>
						<div className='flex items-center space-x-3'>
							<FileText className='w-5 h-5 text-blue-500' />
							<div className='flex-1 min-w-0'>
								<p className='text-sm font-medium text-gray-900 truncate'>
									{selectedFile.name}
								</p>
								<p className='text-xs text-gray-500'>
									{(selectedFile.size / 1024 / 1024).toFixed(2)} MB
								</p>
							</div>
						</div>
						<button
							onClick={handleRemoveFile}
							className='h-8 w-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200'
						>
							<X className='w-4 h-4' />
						</button>
					</div>
				</div>
			)}

			{/* Error Display */}
			{error && (
				<div className='px-6 py-2 bg-red-50 border-t border-red-100'>
					<p className='text-sm text-red-600'>{error}</p>
				</div>
			)}

			{/* Message Input */}
			<div className='bg-white border-t border-gray-200 px-6 py-4'>
				<div className='flex items-center space-x-3'>
					{/* File Input */}
					<input
						ref={fileInputRef}
						type='file'
						accept='.pdf,.txt,.csv,.json'
						onChange={handleFileSelect}
						className='hidden'
					/>
					<button
						onClick={() => fileInputRef.current?.click()}
						className={`cursor-pointer h-10 w-10 rounded-lg flex items-center justify-center transition-colors duration-200 ${
							selectedFile
								? 'bg-blue-100 text-blue-600'
								: 'bg-gray-100 text-gray-500 hover:bg-gray-200'
						}`}
						title='Attach file'
					>
						<Paperclip className='w-4 h-4' />
					</button>

					{/* Text Input */}
					<div className='flex-1 flex items-center justify-center relative'>
						<textarea
							ref={textareaRef}
							value={inputMessage}
							onChange={(e) => {
								setInputMessage(e.target.value);
								handleTextareaResize(e.target);
							}}
							onKeyPress={(e) => {
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault();
									handleSendMessage();
								}
							}}
							placeholder={
								selectedPaper
									? `Ask about "${selectedPaper.title}"... (Enter to send, Shift+Enter for new line)`
									: selectedFile
									? 'Ask about this document... (Enter to send, Shift+Enter for new line)'
									: 'Ask me anything about research papers... (Enter to send, Shift+Enter for new line)'
							}
							className='w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none bg-white disabled:bg-gray-50 disabled:text-gray-500 transition-colors duration-200'
							disabled={isLoading}
							rows={selectedPaper || selectedFile ? 2 : 1}
						/>

						{/* Voice Input */}
						{browserSupportsSpeechRecognition && (
							<button
								onClick={listening ? stopListening : startListening}
								className={`cursor-pointer absolute right-3 top-1/2 transform -translate-y-1/2 h-6 w-6 rounded flex items-center justify-center transition-colors duration-200 ${
									listening
										? 'text-red-500 animate-pulse'
										: 'text-gray-400 hover:text-gray-600'
								}`}
								title={listening ? 'Stop listening' : 'Start voice input'}
							>
								{listening ? (
									<MicOff className='w-4 h-4' />
								) : (
									<Mic className='w-4 h-4' />
								)}
							</button>
						)}
					</div>

					{/* Send Button */}
					<button
						onClick={handleSendMessage}
						disabled={!canSendMessage}
						className={`h-10 w-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
							canSendMessage
								? 'bg-teal-500 text-white hover:bg-teal-600 shadow-sm hover:shadow-md'
								: 'bg-gray-300 text-gray-500 cursor-not-allowed'
						}`}
						title='Send message'
					>
						{isLoading ? (
							<Loader2 className='w-4 h-4 animate-spin' />
						) : (
							<Send className='w-4 h-4' />
						)}
					</button>
				</div>
			</div>
		</div>
	);
};

export default ChatInterface;
