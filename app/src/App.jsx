import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ExplorerPage from './pages/ExplorerPage';

// Split IngredientProfilePage and PrintPage into separate chunks —
// they're only downloaded when the user first navigates to those routes.
const IngredientProfilePage = lazy(() => import('./pages/IngredientProfilePage'));
const PrintPage             = lazy(() => import('./pages/PrintPage'));

export default function App() {
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
