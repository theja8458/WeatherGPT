import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import OnboardingModal from './components/OnboardingModal';
import { useWeather } from './context/WeatherContext';
// Eagerly loaded for instant first paint
import Home from './pages/Home';

// Lazy-loaded routes for optimal bundle code splitting (Prompt 17D)
const Chat = React.lazy(() => import('./pages/Chat'));
const VoiceMode = React.lazy(() => import('./pages/VoiceMode'));
const Advisory = React.lazy(() => import('./pages/Advisory'));
const Alerts = React.lazy(() => import('./pages/Alerts'));
const OfficerDashboard = React.lazy(() => import('./pages/OfficerDashboard'));
const MapPage = React.lazy(() => import('./pages/MapPage'));
const Climate = React.lazy(() => import('./pages/Climate'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));

function PageLoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 space-y-3">
      <div className="w-10 h-10 border-3 border-sky-500/20 border-t-sky-400 rounded-full animate-spin" />
      <p className="text-xs text-slate-400 font-medium tracking-wide">Loading module...</p>
    </div>
  );
}

export default function App() {
  const { showOnboarding, setShowOnboarding } = useWeather();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-sky-500 selection:text-white">
      <div className="w-full max-w-3xl mx-auto min-h-screen flex flex-col bg-slate-900/60 border-x border-slate-800/60 shadow-2xl relative">
        <Header />
        <main className="flex-1 px-3 py-2">
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/voice" element={<VoiceMode />} />
              <Route path="/advisory" element={<Advisory />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/officer" element={<OfficerDashboard />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/climate" element={<Climate />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </main>
        <BottomNav />

        {/* First-Run Onboarding Modal */}
        <OnboardingModal
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
        />
      </div>
    </div>
  );
}
