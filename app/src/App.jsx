import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import useExplorerStore from './store/useExplorerStore';
import ExplorerPage from './pages/ExplorerPage';

// Split IngredientProfilePage and PrintPage into separate chunks —
// they're only downloaded when the user first navigates to those routes.
const IngredientProfilePage = lazy(() => import('./pages/IngredientProfilePage'));
const PrintPage             = lazy(() => import('./pages/PrintPage'));

export default function App() {
  const loadFlavors = useExplorerStore(s => s.loadFlavors);
  const flavors     = useExplorerStore(s => s.flavors);

  // Kick off the async fetch on first mount.
  // Components only render once flavors is non-null.
  useEffect(() => { loadFlavors(); }, [loadFlavors]);

  if (!flavors) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#faf7f2',
        fontFamily: 'Georgia, serif', color: '#c8b48a',
        letterSpacing: '0.1em', fontSize: '0.9rem',
      }}>
        Loading…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/"               element={<ExplorerPage />} />
          <Route path="/ingredient/:id" element={<IngredientProfilePage />} />
          <Route path="/print"          element={<PrintPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
