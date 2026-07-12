import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Docs } from './pages/Docs';
import { GrainOverlay } from './components/GrainOverlay';
import { ScrollToHash } from './components/ScrollToHash';

function App(): React.ReactElement {
  return (
    <>
      <GrainOverlay />
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </>
  );
}

export default App;
