import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import Dashboard from './pages/Dashboard';
import SignupPage from './pages/SignupPage';
import Login from './pages/LoginPage';
import './styles/globals.css';
import './index.css';

function App() {
	return (
		<Router>
			<div className='App'>
				<Routes>
					<Route path='/' element={<HomePage />} />
					<Route path='/dashboard' element={<Dashboard />} />
					<Route path='/signup' element={<SignupPage />} />
					<Route path='/login' element={<Login />} />
				</Routes>
			</div>
		</Router>
	);
}

export default App;
