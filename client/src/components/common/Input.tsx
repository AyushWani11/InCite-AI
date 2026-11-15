import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
	label: string;
	name: string;
	hint?: string;
	error?: string;
}

// A labelled text field with an optional hint and error message. Password
// fields get a show/hide toggle.
const Input: React.FC<InputProps> = ({ label, name, hint, error, type = 'text', className, ...props }) => {
	const id = useId();
	const [revealed, setRevealed] = useState(false);
	const isPassword = type === 'password';
	const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

	return (
		<div className={clsx('space-y-1.5', className)}>
			<label htmlFor={id} className='block text-sm font-medium text-gray-800'>
				{label}
			</label>
			<div className='relative'>
				<input
					id={id}
					name={name}
					type={isPassword && revealed ? 'text' : type}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy}
					className={clsx(
						'w-full rounded-lg border bg-white px-3 py-2.5 text-gray-900 placeholder:text-gray-400',
						'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500',
						isPassword && 'pr-11',
						error ? 'border-red-400' : 'border-gray-300'
					)}
					{...props}
				/>
				{isPassword && (
					<button
						type='button'
						onClick={() => setRevealed((r) => !r)}
						className='absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 rounded-r-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
						aria-label={revealed ? 'Hide password' : 'Show password'}
					>
						{revealed ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
					</button>
				)}
			</div>
			{hint && !error && (
				<p id={`${id}-hint`} className='text-xs text-gray-500'>
					{hint}
				</p>
			)}
			{error && (
				<p id={`${id}-error`} className='text-xs text-red-600'>
					{error}
				</p>
			)}
		</div>
	);
};

export default Input;
