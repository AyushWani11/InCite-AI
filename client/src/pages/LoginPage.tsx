import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import './Login.css';

// Backend URL
const backendUrl =
	process.env.NODE_ENV === 'production'
		? 'https://vegaai.onrender.com/api'
		: 'http://localhost:5000/api';

interface FormData {
	email: string;
	password: string;
}

const Login: React.FC = () => {
	const [formData, setFormData] = useState<FormData>({
		email: '',
		password: '',
	});
	const [error, setError] = useState<string>('');
	const navigate = useNavigate();

	const { email, password } = formData;

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
		setFormData({ ...formData, [e.target.name]: e.target.value });

	const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		try {
			const response = await fetch(backendUrl + '/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include', // Ensure cookies are included in the request
				body: JSON.stringify(formData),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.msg || 'Login failed.');
			}

			setError('');
			navigate('/'); // Redirect after successful login
		} catch (err) {
			setError((err as Error).message);
		}
	};

	return (
		<div className='container'>
			<div className='form-box login'>
				<form onSubmit={onSubmit}>
					<h1>Login</h1>
					{error && <div className='error'>{error}</div>}
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
					<div className='forgot-link'>
						<a href='#'>Forgot Password?</a>
					</div>

					<button type='submit' className='btn login-btn'>
						Login
					</button>
				</form>
			</div>
			<div className='toggle-box'>
				<div className='toggle-panel toggle-left'>
					<h1>Welcome to InCiteAI</h1>
					<p>Don't have an account?</p>
					<a href='/signup' className='btn register-btn'>
						Register
					</a>
				</div>
			</div>
		</div>
	);
};

export default Login;
