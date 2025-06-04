import React from 'react';
import { Navbar } from '../Components/layout';
import {
	HeroSection,
	FeaturesSection,
	SearchSection,
	HowItWorksSection,
} from '../Components/sections';
import { Footer } from '../Components/layout';

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
