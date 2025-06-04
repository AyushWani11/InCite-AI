import React, { useState, useRef, useEffect } from 'react';
import {
	Search,
	Upload,
	Menu,
	X,
	MessageCircle,
	FileText,
	Bookmark,
	FolderOpen,
	Brain,
	Settings,
	ChevronLeft,
	ChevronRight,
	Maximize2,
	Minimize2,
} from 'lucide-react';

// Mock data for papers
const mockPapers = [
	{
		id: 1,
		title: 'Attention Is All You Need',
		authors: 'Ashish Vaswani, et al.',
		venue: 'Google Research • 2017',
		impact: 'High Impact',
		readTime: '15 min read',
		score: '92%',
		uploadDate: 'Apr 21, 2025',
		filename: 'attention_transformer_2017.pdf',
	},
	{
		id: 2,
		title: 'BERT: Pre-training of Deep Bidirectional Transformers',
		authors: 'Jacob Devlin, et al.',
		venue: 'Google AI • 2018',
		impact: 'High Impact',
		readTime: '12 min read',
		score: '89%',
		uploadDate: 'Apr 20, 2025',
		filename: 'bert_bidirectional_2018.pdf',
	},
	{
		id: 3,
		title: 'GPT-3: Language Models are Few-Shot Learners',
		authors: 'Tom B. Brown, et al.',
		venue: 'OpenAI • 2020',
		impact: 'Very High Impact',
		readTime: '20 min read',
		score: '95%',
		uploadDate: 'Apr 19, 2025',
		filename: 'gpt3_few_shot_2020.pdf',
	},
];

// Navbar Component
const Navbar = () => {
	return (
		<nav className='bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between'>
			<div className='flex items-center space-x-4'>
				<div className='text-teal-600 text-2xl font-bold'># ScholarAI</div>
				<div className='relative'>
					<Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4' />
					<input
						type='text'
						placeholder='Search papers...'
						className='pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent w-96'
					/>
				</div>
			</div>
			<div className='flex items-center space-x-4'>
				<button className='bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors flex items-center space-x-2'>
					<Upload className='w-4 h-4' />
					<span>Upload Paper</span>
				</button>
				<div className='w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white font-medium'>
					JS
				</div>
			</div>
		</nav>
	);
};

// Sidebar Component
const Sidebar = ({
	selectedPaper,
	onPaperSelect,
	isCollapsed,
	onToggleCollapse,
}) => {
	const [searchQuery, setSearchQuery] = useState('');

	const filteredPapers = mockPapers.filter(
		(paper) =>
			paper.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			paper.authors.toLowerCase().includes(searchQuery.toLowerCase())
	);

	return (
		<div
			className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
				isCollapsed ? 'w-16' : 'w-80'
			}`}
		>
			<div className='p-4 border-b border-gray-200'>
				<div className='flex items-center justify-between mb-4'>
					<h2
						className={`text-lg font-semibold text-gray-800 transition-opacity ${
							isCollapsed ? 'opacity-0' : 'opacity-100'
						}`}
					>
						LIBRARY
					</h2>
					<button
						onClick={onToggleCollapse}
						className='p-1 hover:bg-gray-100 rounded'
					>
						{isCollapsed ? (
							<ChevronRight className='w-4 h-4' />
						) : (
							<ChevronLeft className='w-4 h-4' />
						)}
					</button>
				</div>

				{!isCollapsed && (
					<div className='relative'>
						<Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4' />
						<input
							type='text'
							placeholder='Search papers...'
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent'
						/>
					</div>
				)}
			</div>

			<div className='flex-1 overflow-y-auto'>
				{!isCollapsed && (
					<div className='p-4'>
						<div className='space-y-2 mb-6'>
							<div className='flex items-center space-x-3 text-teal-600 bg-teal-50 px-3 py-2 rounded-lg'>
								<FileText className='w-4 h-4' />
								<span className='text-sm font-medium'>Recent Papers</span>
							</div>
							<div className='flex items-center space-x-3 text-gray-600 hover:text-teal-600 hover:bg-gray-50 px-3 py-2 rounded-lg cursor-pointer'>
								<Bookmark className='w-4 h-4' />
								<span className='text-sm'>Bookmarked</span>
							</div>
							<div className='flex items-center space-x-3 text-gray-600 hover:text-teal-600 hover:bg-gray-50 px-3 py-2 rounded-lg cursor-pointer'>
								<FolderOpen className='w-4 h-4' />
								<span className='text-sm'>All Papers</span>
							</div>
							<div className='flex items-center space-x-3 text-gray-600 hover:text-teal-600 hover:bg-gray-50 px-3 py-2 rounded-lg cursor-pointer'>
								<FolderOpen className='w-4 h-4' />
								<span className='text-sm'>Collections</span>
							</div>
						</div>

						<div className='space-y-3'>
							<h3 className='text-sm font-medium text-gray-500 uppercase tracking-wide'>
								Papers
							</h3>
							{filteredPapers.map((paper) => (
								<div
									key={paper.id}
									onClick={() => onPaperSelect(paper)}
									className={`p-3 rounded-lg cursor-pointer transition-colors border ${
										selectedPaper?.id === paper.id
											? 'bg-teal-50 border-teal-200'
											: 'bg-gray-50 border-gray-200 hover:bg-gray-100'
									}`}
								>
									<h4 className='font-medium text-gray-900 text-sm mb-1 line-clamp-2'>
										{paper.title}
									</h4>
									<p className='text-xs text-gray-600 mb-2'>{paper.authors}</p>
									<div className='flex items-center justify-between'>
										<span className='text-xs text-teal-600 font-medium'>
											{paper.score}
										</span>
										<span className='text-xs text-gray-500'>
											{paper.readTime}
										</span>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

// Paper Viewer Component
const PaperViewer = ({ paper, width }) => {
	return (
		<div
			className='bg-white border-r border-gray-200 flex flex-col overflow-hidden transition-all duration-300'
			style={{ width: `${width}%` }}
		>
			<div className='p-6 border-b border-gray-200'>
				<div className='flex items-center justify-between mb-4'>
					<h1 className='text-2xl font-bold text-gray-900'>{paper.title}</h1>
					<div className='flex items-center space-x-2'>
						<span className='bg-teal-100 text-teal-800 text-xs font-medium px-2 py-1 rounded'>
							{paper.impact}
						</span>
						<span className='bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded'>
							{paper.score}
						</span>
					</div>
				</div>
				<div className='flex items-center space-x-4 text-sm text-gray-600 mb-4'>
					<span>{paper.authors}</span>
					<span>•</span>
					<span>{paper.venue}</span>
					<span>•</span>
					<span>{paper.readTime}</span>
				</div>
			</div>

			<div className='flex-1 overflow-y-auto p-6'>
				<div className='prose max-w-none'>
					<h2 className='text-xl font-semibold mb-4'>Abstract</h2>
					<p className='text-gray-700 leading-relaxed mb-6'>
						The dominant sequence transduction models are based on complex
						recurrent or convolutional neural networks that include an encoder
						and a decoder. The best performing models also connect the encoder
						and decoder through an attention mechanism. We propose a new simple
						network architecture, the Transformer, based solely on attention
						mechanisms, dispensing with recurrence and convolutions entirely.
					</p>

					<h2 className='text-xl font-semibold mb-4'>Introduction</h2>
					<p className='text-gray-700 leading-relaxed mb-6'>
						Recurrent neural networks, long short-term memory and gated
						recurrent neural networks in particular, have been firmly
						established as state of the art approaches in sequence modeling and
						transduction problems such as language modeling and machine
						translation. Numerous efforts have since continued to push the
						boundaries of recurrent language models and encoder-decoder
						architectures.
					</p>

					<p className='text-gray-700 leading-relaxed mb-6'>
						Attention mechanisms have become an integral part of compelling
						sequence modeling and transduction models in various tasks, allowing
						modeling of dependencies without regard to their distance in the
						input or output sequences. In all but a few cases, however, such
						attention mechanisms are used in conjunction with a recurrent
						network.
					</p>

					<h2 className='text-xl font-semibold mb-4'>Model Architecture</h2>
					<p className='text-gray-700 leading-relaxed mb-6'>
						Most competitive neural sequence transduction models have an
						encoder-decoder structure. Here, the encoder maps an input sequence
						of symbol representations to a sequence of continuous
						representations. Given z, the decoder then generates an output
						sequence of symbols one element at a time.
					</p>

					<p className='text-gray-700 leading-relaxed mb-6'>
						The Transformer follows this overall architecture using stacked
						self-attention and point-wise, fully connected layers for both the
						encoder and decoder, shown in the left and right halves
						respectively.
					</p>
				</div>
			</div>
		</div>
	);
};

// Chatbot Component
const Chatbot = ({ paper, width, isFullWidth }) => {
	const [messages, setMessages] = useState([]);
	const [inputMessage, setInputMessage] = useState('');
	const [isMinimized, setIsMinimized] = useState(false);
	const messagesEndRef = useRef(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	useEffect(() => {
		if (paper) {
			setMessages([
				{
					id: 1,
					type: 'bot',
					content: `Welcome! I'm your AI research assistant. I can help you understand this paper on ${paper.title}. What would you like to know?`,
					timestamp: new Date(),
				},
			]);
		} else {
			setMessages([
				{
					id: 1,
					type: 'bot',
					content:
						"Welcome! I'm your AI research assistant. Upload a paper or select one from your library to get started with analysis and Q&A.",
					timestamp: new Date(),
				},
			]);
		}
	}, [paper]);

	const handleSendMessage = () => {
		if (!inputMessage.trim()) return;

		const userMessage = {
			id: messages.length + 1,
			type: 'user',
			content: inputMessage,
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMessage]);

		// Simulate bot response
		setTimeout(() => {
			const botMessage = {
				id: messages.length + 2,
				type: 'bot',
				content: paper
					? `Great question about "${paper.title}"! The key innovation in this paper compared to previous sequence models is the complete elimination of recurrence and convolutions in sequence modeling. Instead, the paper introduces the Transformer architecture that relies entirely on attention mechanisms to draw global dependencies between input and output.`
					: 'Please select a paper from your library or upload a new one to start our discussion about research topics.',
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, botMessage]);
		}, 1000);

		setInputMessage('');
	};

	const handleKeyPress = (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	return (
		<div
			className={`bg-gray-50 flex flex-col transition-all duration-300 ${
				isFullWidth ? 'w-full' : ''
			}`}
			style={!isFullWidth ? { width: `${width}%` } : {}}
		>
			<div className='bg-white border-b border-gray-200 p-4 flex items-center justify-between'>
				<div className='flex items-center space-x-3'>
					<div className='w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center'>
						<Brain className='w-4 h-4 text-white' />
					</div>
					<div>
						<h3 className='font-medium text-gray-900'>AI Research Assistant</h3>
						<p className='text-sm text-gray-500'>
							{paper
								? `Ask questions about this paper or your research`
								: 'Powered by AI'}
						</p>
					</div>
				</div>
				<button
					onClick={() => setIsMinimized(!isMinimized)}
					className='p-1 hover:bg-gray-100 rounded'
				>
					{isMinimized ? (
						<Maximize2 className='w-4 h-4' />
					) : (
						<Minimize2 className='w-4 h-4' />
					)}
				</button>
			</div>

			{!isMinimized && (
				<>
					{paper && (
						<div className='bg-teal-50 border-b border-teal-100 p-4'>
							<div className='bg-white p-3 rounded-lg border border-teal-200'>
								<div className='flex items-center justify-between mb-2'>
									<span className='text-sm font-medium text-teal-800'>
										Quick Question
									</span>
									<span className='text-xs text-teal-600'>Suggested</span>
								</div>
								<button
									onClick={() =>
										setInputMessage(
											'Can you explain the key innovation in this paper compared to previous sequence models?'
										)
									}
									className='text-sm text-teal-700 hover:text-teal-800 text-left w-full'
								>
									Can you explain the key innovation in this paper compared to
									previous sequence models?
								</button>
							</div>
						</div>
					)}

					<div className='flex-1 overflow-y-auto p-4 space-y-4'>
						{messages.map((message) => (
							<div
								key={message.id}
								className={`flex ${
									message.type === 'user' ? 'justify-end' : 'justify-start'
								}`}
							>
								<div
									className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
										message.type === 'user'
											? 'bg-teal-600 text-white'
											: 'bg-white border border-gray-200 text-gray-900'
									}`}
								>
									<p className='text-sm'>{message.content}</p>
								</div>
							</div>
						))}
						<div ref={messagesEndRef} />
					</div>

					<div className='bg-white border-t border-gray-200 p-4'>
						<div className='flex space-x-2'>
							<textarea
								value={inputMessage}
								onChange={(e) => setInputMessage(e.target.value)}
								onKeyPress={handleKeyPress}
								placeholder={
									paper
										? 'Ask about this paper...'
										: 'Select a paper to start chatting...'
								}
								className='flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none'
								rows='2'
							/>
							<button
								onClick={handleSendMessage}
								disabled={!inputMessage.trim()}
								className='bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors'
							>
								<MessageCircle className='w-4 h-4' />
							</button>
						</div>
					</div>
				</>
			)}
		</div>
	);
};

// Resizer Component
const Resizer = ({ onResize, isResizing, setIsResizing }) => {
	const resizerRef = useRef(null);

	const handleMouseDown = (e) => {
		setIsResizing(true);
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	};

	const handleMouseMove = (e) => {
		if (onResize) {
			onResize(e.clientX);
		}
	};

	const handleMouseUp = () => {
		setIsResizing(false);
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('mouseup', handleMouseUp);
	};

	return (
		<div
			ref={resizerRef}
			className={`w-1 bg-gray-300 hover:bg-teal-500 cursor-col-resize transition-colors ${
				isResizing ? 'bg-teal-500' : ''
			}`}
			onMouseDown={handleMouseDown}
		/>
	);
};

// Main Dashboard Component
const Dashboard = () => {
	const [selectedPaper, setSelectedPaper] = useState(null);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [paperWidth, setPaperWidth] = useState(60);
	const [isResizing, setIsResizing] = useState(false);
	const containerRef = useRef(null);

	const handlePaperSelect = (paper) => {
		setSelectedPaper(paper);
	};

	const handleResize = (clientX) => {
		if (containerRef.current && selectedPaper) {
			const containerRect = containerRef.current.getBoundingClientRect();
			const sidebarWidth = sidebarCollapsed ? 64 : 320;
			const availableWidth = containerRect.width - sidebarWidth;
			const newPaperWidth = Math.max(
				30,
				Math.min(
					80,
					((clientX - containerRect.left - sidebarWidth) / availableWidth) * 100
				)
			);
			setPaperWidth(newPaperWidth);
		}
	};

	return (
		<div className='h-screen flex flex-col bg-gray-100'>
			<Navbar />
			<div ref={containerRef} className='flex-1 flex overflow-hidden'>
				<Sidebar
					selectedPaper={selectedPaper}
					onPaperSelect={handlePaperSelect}
					isCollapsed={sidebarCollapsed}
					onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
				/>

				{selectedPaper ? (
					<>
						<PaperViewer paper={selectedPaper} width={paperWidth} />
						<Resizer
							onResize={handleResize}
							isResizing={isResizing}
							setIsResizing={setIsResizing}
						/>
						<Chatbot
							paper={selectedPaper}
							width={100 - paperWidth}
							isFullWidth={false}
						/>
					</>
				) : (
					<Chatbot paper={null} width={100} isFullWidth={true} />
				)}
			</div>
		</div>
	);
};

export default Dashboard;
