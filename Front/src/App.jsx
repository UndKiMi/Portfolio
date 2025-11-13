import React from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DiscordPresence from './components/DiscordPresence';
import SensCritique from './components/SensCritique';
import GitHubSection from './components/GitHubSection';
import './App.css';

function App() {
  return (
    <div className="container">
      <Sidebar />
      <main className="content" role="main">
        <Header />
        <DiscordPresence />
        <SensCritique />
        <GitHubSection />
      </main>
    </div>
  );
}

export default App;

