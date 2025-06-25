// src/Components/layout/DashNavbar.tsx

import React, { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

const backendUrl =
	process.env.NODE_ENV === 'production'
		? process.env.BACKEND_URL
		: 'https://incite-ai-4vrv.onrender.com/api';

interface User {
	id: string;
	username: string;
	email: string;
}

const DashNavbar: React.FC = () => {
	const [user, setUser] = useState<User | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		fetch(`${backendUrl}/auth/check-login`, {
			method: 'GET',
			credentials: 'include',
		})
			.then((res) => res.json())
			.then((data) => {
				if (data.user?.username) {
					setUser(data.user);
				}
			})
			.catch(() => setUser(null));
	}, []);

	const getUserInitial = () => {
		if (!user || !user.username) return 'U';
		return user.username.charAt(0).toUpperCase();
	};

	const handleUploadClick = () => {
		if (fileInputRef.current && !isUploading) {
			fileInputRef.current.click();
		}
	};

	const handleFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		setIsUploading(true);
		const formData = new FormData();
		for (let i = 0; i < files.length; i++) {
			formData.append('files', files[i]);
		}

		try {
			const response = await fetch(`${backendUrl}/paper/upload`, {
				method: 'POST',
				credentials: 'include',
				body: formData,
			});

			if (!response.ok) {
				const errJson = await response.json();
				console.error('Upload failed:', errJson);
				alert(`Upload error: ${errJson.error || response.statusText}`);
				return;
			}

			const json = await response.json();
			console.log('Upload successful:', json);
			alert('Paper(s) uploaded successfully!');
			window.location.reload();
		} catch (err) {
			console.error('Upload exception:', err);
			alert('Upload failed due to network error');
		} finally {
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
			setIsUploading(false);
		}
	};

	return (
		<nav className='bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between'>
			<input
				type='file'
				accept='.pdf'
				multiple
				ref={fileInputRef}
				style={{ display: 'none' }}
				onChange={handleFilesSelected}
			/>

			<div className='flex items-center space-x-4'>
				<Link
					to='/'
					className='flex items-center space-x-2 hover:opacity-80 transition-opacity'
				>
					<div className='w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center'>
						<span className='text-white font-bold text-lg'>#</span>
					</div>
					<span className='text-3xl font-semibold text-gray-800'>
						InCite AI
					</span>
				</Link>
			</div>

			<div className='flex items-center space-x-4'>
				<button
					onClick={handleUploadClick}
					disabled={isUploading}
					className={`${
						isUploading
							? 'bg-gray-400 cursor-not-allowed'
							: 'cursor-pointer bg-teal-500 hover:bg-teal-600'
					}  text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors`}
				>
					<Upload className='w-4 h-4' />
					<span>{isUploading ? 'Uploading...' : 'Upload Paper'}</span>
				</button>

				<div
					className='w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center text-white font-semibold cursor-pointer hover:bg-teal-600 transition-colors'
					title={user ? `${user.username}` : 'User'}
				>
					{getUserInitial()}
				</div>
			</div>
		</nav>
	);
};

export default DashNavbar;
