import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import './Login.css';

// Backend URL
const backendUrl =
	process.env.NODE_ENV === 'production'
		? 'https://vegaai.onrender.com/api'
		: 'http://localhost:5001/api';

const Login = () => {
	const [formData, setFormData] = useState({
		email: '',
		password: '',
	});
	const [error, setError] = useState('');
	const navigate = useNavigate();

	const { email, password } = formData;

	const onChange = (e) =>
		setFormData({ ...formData, [e.target.name]: e.target.value });

	const onSubmit = async (e) => {
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
			setError(err.message);
		}
	};

	return (  
    <div className="container">
    <div className="form-box login">
      <form action="">
        <h1>Login</h1>
        <div className="input-box">
          <input type="email" placeholder="Email" value={email} onChange={onChange} required></input>
          <i className='bx bxs-user'></i>
        </div>
        <div className="input-box">
          <input type="password" placeholder="Password" value={password} onChange={onChange} required></input>
          <i className='bx bxs-lock-alt'></i>
        </div>
        <div className='forgot-link'>
            <a href='#'>Forgot Password?</a>
        </div>
        
        <button type="submit" className='btn login-btn'>Login</button>
        

      </form>
    </div>
    <div className='toggle-box'>
        <div className='toggle-panel toggle-left'>
            <h1>Welcome to InCiteAI</h1>
            <p>Don't have an account?</p>
            <a href='/signup' className='btn register-btn'>Register</a>
        </div>
        
    </div>
    
    
  </div>
);



};

export default Login;