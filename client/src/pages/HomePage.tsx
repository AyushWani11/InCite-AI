import React from 'react';
import { Navbar, Footer } from '../components/layout';
import { HeroSection, FeaturesSection, AnswersSection, HowItWorksSection } from '../components/sections';

const HomePage: React.FC = () => (
	<div className='min-h-screen bg-white'>
		<Navbar />
		<main>
			<HeroSection />
			<FeaturesSection />
			<AnswersSection />
			<HowItWorksSection />
		</main>
		<Footer />
	</div>
);

export default HomePage;
