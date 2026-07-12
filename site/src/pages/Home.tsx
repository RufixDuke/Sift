import React from 'react';
import { SEO } from '../components/SEO';
import { ScrollReveal } from '../components/ScrollReveal';
import { Nav } from '../sections/Nav';
import { Hero } from '../sections/Hero';
import { Problem } from '../sections/Problem';
import { Features } from '../sections/Features';
import { Demo } from '../sections/Demo';
import { Install } from '../sections/Install';
import { Footer } from '../sections/Footer';

export function Home(): React.ReactElement {
  return (
    <>
      <SEO />
      <Nav />
      <main>
        <Hero />
        <ScrollReveal>
          <Problem />
        </ScrollReveal>
        <ScrollReveal>
          <Features />
        </ScrollReveal>
        <ScrollReveal>
          <Demo />
        </ScrollReveal>
        <ScrollReveal>
          <Install />
        </ScrollReveal>
      </main>
      <Footer />
    </>
  );
}
