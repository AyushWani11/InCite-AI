import React from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { clsx } from 'clsx';

export interface ToastMessage {
	text: string;
	tone: 'success' | 'error';
}

interface ToastProps {
	toast: ToastMessage | null;
	onDismiss: () => void;
}

// A short status message under the navbar (top right), announced to screen
// readers. Replaces alert() pop-ups. Kept at the top so it never covers the
// chat input.
const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => (
	<div aria-live='polite' className='fixed top-20 inset-x-4 sm:inset-x-auto sm:right-4 z-50 flex justify-center pointer-events-none'>
		{toast && (
			<div
				role='status'
				className={clsx(
					'pointer-events-auto flex items-start gap-3 w-full sm:w-96 rounded-xl border px-4 py-3 shadow-lg bg-white',
					toast.tone === 'success' ? 'border-teal-200' : 'border-red-200'
				)}
			>
				{toast.tone === 'success' ? (
					<CheckCircle2 className='w-5 h-5 text-teal-600 shrink-0 mt-0.5' aria-hidden='true' />
				) : (
					<AlertCircle className='w-5 h-5 text-red-600 shrink-0 mt-0.5' aria-hidden='true' />
				)}
				<p className='flex-1 text-sm text-gray-800 whitespace-pre-line'>{toast.text}</p>
				<button
					type='button'
					onClick={onDismiss}
					className='p-1 -m-1 rounded text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
					aria-label='Dismiss'
				>
					<X className='w-4 h-4' />
				</button>
			</div>
		)}
	</div>
);

export default Toast;
