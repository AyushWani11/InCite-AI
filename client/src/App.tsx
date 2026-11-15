import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SignupPage from './pages/SignupPage';
import Login from './pages/LoginPage';
import './styles/globals.css';
import './index.css';

// The dashboard (chat, PDF viewer, math rendering, markdown) is most of the
// app's code. Loading it only when it's opened keeps the home and login pages
// light.
const Dashboard = lazy(() => import('./pages/Dashboard'));

const Loading = () => (
	<div className='h-dvh flex items-center justify-center bg-gray-50 text-gray-600' role='status'>
		Loading…
	</div>
);

function App() {
	return (
		<Router>
			<div className='App'>
				<Routes>
					<Route path='/' element={<HomePage />} />
					<Route
						path='/dashboard'
						element={
							<Suspense fallback={<Loading />}>
								<Dashboard />
							</Suspense>
						}
					/>
					<Route path='/signup' element={<SignupPage />} />
					<Route path='/login' element={<Login />} />
				</Routes>
			</div>
		</Router>
	);
}

export default App;
