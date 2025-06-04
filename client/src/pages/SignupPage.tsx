import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import './Signup.css';

// Backend URL
const backendUrl: string =
	process.env.NODE_ENV === 'production'
		? 'https://vegaai.onrender.com/api'
		: 'http://localhost:5001/api';

// Type definitions
interface FormData {
	username: string;
	email: string;
	password: string;
	confirm: string;
}

interface ApiResponse {
	msg?: string;
	// Add other expected response properties here
}

const Signup: React.FC = () => {
	const [formData, setFormData] = useState<FormData>({
		username: '',
		email: '',
		password: '',
		confirm: '',
	});
	const [error, setError] = useState<string>('');
	const [success, setSuccess] = useState<string>('');
	const navigate = useNavigate();

	const { username, email, password, confirm } = formData;

	const onChange = (e: React.ChangeEvent<HTMLInputElement>): void =>
		setFormData({ ...formData, [e.target.name]: e.target.value });

	const onSubmit = async (
		e: React.FormEvent<HTMLFormElement>
	): Promise<void> => {
		e.preventDefault();

		try {
			const response: Response = await fetch(backendUrl + '/auth/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include', // Include cookies in the request
				body: JSON.stringify(formData),
			});

			const data: ApiResponse = await response.json();

			if (!response.ok) {
				throw new Error(data.msg || 'Registration failed.');
			}

			setSuccess('Registration successful!');
			setError('');
			navigate('/'); // Redirect after successful registration
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : 'An unknown error occurred';
			setError(errorMessage);
			setSuccess('');
		}
	};

	return (
		<div className='container'>
			<div className='form-box login'>
				<form onSubmit={onSubmit}>
					<h1>Sign Up</h1>
					{error && <div className='error-message'>{error}</div>}
					{success && <div className='success-message'>{success}</div>}
					<div className='input-box'>
						<input
							type='text'
							name='username'
							placeholder='Username'
							value={username}
							onChange={onChange}
							required
						/>
						{/* <i className='bx bxs-user'></i> */}
					</div>
					<div className='input-box'>
						<input
							type='email'
							name='email'
							placeholder='Email'
							value={email}
							onChange={onChange}
							required
						/>
						<i className='bx bxs-user'></i>
					</div>
					<div className='input-box'>
						<input
							type='password'
							name='password'
							placeholder='Password'
							value={password}
							onChange={onChange}
							required
						/>
						<i className='bx bxs-lock-alt'></i>
					</div>
					<div className='input-box'>
						<input
							type='password'
							name='confirm'
							placeholder='Confirm Password'
							value={confirm}
							onChange={onChange}
							required
						/>
						<i className='bx bxs-lock-alt'></i>
					</div>

					<button type='submit' className='btn login-btn'>
						Sign Up
					</button>
				</form>
			</div>
			<div className='toggle-box'>
				<div className='toggle-panel toggle-right'>
					<h1>Welcome to InCiteAI</h1>
					<p>Already have an account?</p>
					<a href='/login' className='btn register-btn'>
						Login
					</a>
				</div>
			</div>
		</div>
	);
};

export default Signup;
