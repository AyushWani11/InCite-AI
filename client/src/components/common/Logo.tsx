import React from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { clsx } from 'clsx';

interface LogoProps {
	to?: string;
	// 'light' is for dark backgrounds (the footer).
	tone?: 'dark' | 'light';
	className?: string;
}

const Logo: React.FC<LogoProps> = ({ to = '/', tone = 'dark', className }) => (
	<Link
		to={to}
		className={clsx(
			'inline-flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2',
			tone === 'light' && 'focus-visible:ring-offset-gray-900',
			className
		)}
	>
		<span className='w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center shrink-0'>
			<FileText className='w-5 h-5 text-white' aria-hidden='true' />
		</span>
		<span className={clsx('text-xl font-bold whitespace-nowrap', tone === 'light' ? 'text-white' : 'text-gray-900')}>
			InCite AI
		</span>
	</Link>
);

export default Logo;
