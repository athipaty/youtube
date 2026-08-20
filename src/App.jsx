import { NavLink, useLocation } from 'react-router-dom';
import { Component } from 'react';
import SeriesPage from './pages/SeriesPage';
import EpisodesPage from './pages/EpisodesPage';
import { useLanguage } from './utils/i18n';

function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <div className="flex items-center rounded-full bg-slate-800 p-0.5 text-xs font-bold">
      {['en', 'th'].map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 rounded-full transition-colors ${lang === l ? 'bg-reel text-white shadow-soft' : 'text-slate-500 hover:text-slate-300'}`}
        >
          {l === 'en' ? 'EN' : 'ไทย'}
        </button>
      ))}
    </div>
  );
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-black p-6 text-sm">
          <p className="font-bold text-red-500 mb-2">App Error</p>
          <pre className="text-red-400 whitespace-pre-wrap break-all text-xs bg-red-950 p-3 rounded">
            {this.state.error?.message}
            {'\n'}
            {this.state.error?.stack?.slice(0, 500)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppShell() {
  const location = useLocation();
  const tab = location.pathname === '/episodes' ? 'episodes' : 'series';
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-slate-950 text-slate-50 antialiased pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <div className="fixed top-3 right-3 z-50">
        <LanguageToggle />
      </div>
      {/* Both tabs stay mounted permanently (just hidden) instead of unmounting on navigation —
          same reasoning as the sibling amazon-tracker project: switching tabs shouldn't tear down
          socket connections or re-fetch everything from scratch. */}
      <div style={{ display: tab === 'series' ? 'block' : 'none' }}>
        <SeriesPage />
      </div>
      <div style={{ display: tab === 'episodes' ? 'block' : 'none' }}>
        <EpisodesPage />
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-2 bg-slate-900/90 backdrop-blur-md border-t border-slate-800/60 pb-[env(safe-area-inset-bottom)]">
        <NavLink to="/" end
          className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-sm font-semibold transition-colors duration-200 ${isActive ? 'text-reel' : 'text-slate-600 hover:text-slate-500'}`}>
          <span className="text-lg leading-none">🎭</span>
          {t('nav.series')}
        </NavLink>
        <NavLink to="/episodes"
          className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2.5 text-sm font-semibold transition-colors duration-200 ${isActive ? 'text-reel' : 'text-slate-600 hover:text-slate-500'}`}>
          <span className="text-lg leading-none">🎬</span>
          {t('nav.episodes')}
        </NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
