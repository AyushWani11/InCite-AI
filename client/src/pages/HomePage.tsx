import React from 'react';
import { Navbar, Footer } from '../components/layout';
import { HeroSection, FeaturesSection, AnswersSection, HowItWorksSection } from '../components/sections';

const HomePage: React.FC = () => (
	<div className='min-h-screen bg-white'>
		<title>InCite AI · Chat with your research papers</title>
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
