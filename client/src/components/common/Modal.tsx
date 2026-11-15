import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
	open: boolean;
	onClose: () => void;
	title: string;
	icon?: React.ReactNode;
	children: React.ReactNode;
	footer?: React.ReactNode;
}

// A pop-up window built on the browser's <dialog>, which gives us for free:
// Escape closes it, keyboard focus stays inside, and the page behind it can't
// be clicked or read by screen readers. Clicking the dimmed backdrop closes it.
const Modal: React.FC<ModalProps> = ({ open, onClose, title, icon, children, footer }) => {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useId();

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		<dialog
			ref={ref}
			aria-labelledby={titleId}
			onClose={onClose}
			onClick={(e) => e.target === e.currentTarget && onClose()}
			className='m-auto w-[min(64rem,calc(100%-2rem))] max-h-[90dvh] rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-gray-900/50 backdrop:backdrop-blur-sm'
		>
			{open && (
				<div className='flex max-h-[90dvh] flex-col'>
					<div className='flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 sm:px-6'>
						<div className='flex min-w-0 items-center gap-3'>
							{icon && (
								<span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700'>
									{icon}
								</span>
							)}
							<h2 id={titleId} className='truncate text-lg font-semibold text-gray-900'>
								{title}
							</h2>
						</div>
						<button
							type='button'
							onClick={onClose}
							aria-label='Close'
							className='rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
						>
							<X className='h-5 w-5' />
						</button>
					</div>
					<div className='flex-1 overflow-y-auto bg-gray-50 px-5 py-5 sm:px-6'>{children}</div>
					{footer && <div className='border-t border-gray-200 px-5 py-3 sm:px-6'>{footer}</div>}
				</div>
			)}
		</dialog>
	);
};

export default Modal;
