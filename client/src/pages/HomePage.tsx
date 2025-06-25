import React from 'react';
import { Navbar } from '../components/layout';
import {
	HeroSection,
	FeaturesSection,
	SearchSection,
	HowItWorksSection,
} from '../components/sections';
import { Footer } from '../components/layout';

const HomePage: React.FC = () => {
	return (
		<div className='min-h-screen bg-white'>
			<Navbar />
			<main>
				<HeroSection />
				<FeaturesSection />
				<SearchSection />
				<HowItWorksSection />
			</main>
			<Footer />
		</div>
	);
};

export default HomePage;
