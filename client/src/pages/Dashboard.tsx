import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
	FileText,
	BookOpen,
	Star,
	Calendar,
	Download,
	X,
	Menu,
} from 'lucide-react';

import SidebarPapers from '../Components/layout/SidebarPapers';
import ChatInterface from '../Components/layout/ChatInterface';
import DashNavbar from '../Components/layout/DashNavbar';
import PaperViewer from '../Components/layout/PaperViewer';

const backendUrl =
	process.env.NODE_ENV === 'production'
		? process.env.BACKEND_URL
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
	const [isSidebarOpen, setIsSidebarOpen] = useState(true);

	const handlePaperSelect = useCallback((paper: Paper | null) => {
		setSelectedPaper(paper);
	}, []);

	const handleClosePaper = useCallback(() => {
		setSelectedPaper(null);
	}, []);

	const handleResize = useCallback(
		(deltaX: number) => {
			const containerWidth = window.innerWidth - (isSidebarOpen ? 320 : 0);
			const deltaPercent = (deltaX / containerWidth) * 100;
			setPaperViewWidth((p) => Math.max(30, Math.min(80, p + deltaPercent)));
		},
		[isSidebarOpen]
	);

	const toggleSidebar = useCallback(() => {
		setIsSidebarOpen((o) => !o);
	}, []);

	return (
		<div className='h-screen flex flex-col bg-gray-50'>
			<DashNavbar />

			<div className='flex-1 flex overflow-hidden'>
				{/* SHOW “☰” WHEN SIDEBAR IS HIDDEN */}
				{!isSidebarOpen && (
					<button
						className='p-2 bg-white cursor-pointer'
						onClick={toggleSidebar}
						aria-label='Open sidebar'
					>
						<Menu size={24} />
					</button>
				)}

				{/* SIDEBAR */}

				<div
					className={`
    flex-shrink-0
    overflow-hidden
    border-r border-gray-200 bg-white
    transition-all duration-300 ease-in-out
    ${isSidebarOpen ? 'w-80' : 'w-0'}
  `}
				>
					{/* Only show the close button when fully open */}
					<button
						className={`p-2 float-right cursor-pointer ${
							isSidebarOpen ? '' : 'opacity-0 pointer-events-none'
						}`}
						onClick={toggleSidebar}
						aria-label='Close sidebar'
					>
						<X size={20} />
					</button>

					{/* If you want to hide the list when closed: */}
					<div
						className={`${
							isSidebarOpen ? 'opacity-100' : 'opacity-0'
						} transition-opacity duration-200`}
					>
						<SidebarPapers
							selectedPaper={selectedPaper}
							onPaperSelect={handlePaperSelect}
						/>
					</div>
				</div>

				{/* MAIN CONTENT */}
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
