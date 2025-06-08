import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FileText, BookOpen, Star, Calendar, Download, X } from 'lucide-react';

import SidebarPapers from '../Components/layout/SidebarPapers';
import ChatInterface from '../Components/layout/ChatInterface';
import DashNavbar from '../Components/layout/DashNavbar';
import PaperViewer from '../Components/layout/PaperViewer';

const backendUrl =
	process.env.NODE_ENV === 'production'
		? 'https://vegaai.onrender.com/api'
		: 'http://localhost:5000/api';

// Types matching your backend structure
interface Paper {
	_id: string;
	title: string;
	authors?: string[];
	filename?: string;
	createdAt: string;
}

interface Message {
	id: string;
	type: 'user' | 'assistant';
	content: string;
	timestamp: Date;
}

// Add user interface
interface User {
	id: string;
	username: string;
	email: string;
}

// Navbar Component

// Resizable Handle Component
const ResizableHandle: React.FC<{ onResize: (deltaX: number) => void }> = ({
	onResize,
}) => {
	const [isDragging, setIsDragging] = useState(false);
	const lastX = useRef(0);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		setIsDragging(true);
		lastX.current = e.clientX;
		e.preventDefault();
	}, []);

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (isDragging) {
				const deltaX = e.clientX - lastX.current;
				onResize(deltaX);
				lastX.current = e.clientX;
			}
		},
		[isDragging, onResize]
	);

	const handleMouseUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	React.useEffect(() => {
		if (isDragging) {
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			return () => {
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
			};
		}
	}, [isDragging, handleMouseMove, handleMouseUp]);

	return (
		<div
			className='w-1 bg-gray-200 hover:bg-teal-500 cursor-col-resize transition-colors'
			onMouseDown={handleMouseDown}
		/>
	);
};

// Main Dashboard Component
const Dashboard: React.FC = () => {
	const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
	const [paperViewWidth, setPaperViewWidth] = useState(60);

	const handlePaperSelect = useCallback((paper: Paper | null) => {
		setSelectedPaper(paper);
	}, []);

	const handleClosePaper = useCallback(() => {
		setSelectedPaper(null);
	}, []);

	const handleResize = useCallback((deltaX: number) => {
		const containerWidth = window.innerWidth - 320;
		const deltaPercentage = (deltaX / containerWidth) * 100;
		setPaperViewWidth((prev) =>
			Math.max(30, Math.min(80, prev + deltaPercentage))
		);
	}, []);

	return (
		<div className='h-screen flex flex-col bg-gray-50'>
			<DashNavbar />

			<div className='flex-1 flex height-full overflow-hidden'>
				<div className='w-80 border-gray-200 overflow-y-auto bg-white border-r'>
					<SidebarPapers
						onPaperSelect={handlePaperSelect}
						selectedPaper={selectedPaper}
					/>
				</div>

				<div className='flex-1 flex transition-all duration-300'>
					{selectedPaper ? (
						<>
							<div
								className='overflow-hidden transition-all duration-300'
								style={{ width: `${paperViewWidth}%` }}
							>
								<PaperViewer paper={selectedPaper} onClose={handleClosePaper} />
							</div>

							<ResizableHandle onResize={handleResize} />

							<div
								className='overflow-hidden transition-all duration-300'
								style={{ width: `${100 - paperViewWidth}%` }}
							>
								<ChatInterface selectedPaper={selectedPaper} />
							</div>
						</>
					) : (
						<div className='w-full transition-all duration-300'>
							<ChatInterface selectedPaper={null} />
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default Dashboard;
