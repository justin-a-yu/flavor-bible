import { HashRouter, Routes, Route } from 'react-router-dom';
import ExplorerPage from './pages/ExplorerPage';
import IngredientProfilePage from './pages/IngredientProfilePage';
import PrintPage from './pages/PrintPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ExplorerPage />} />
        <Route path="/ingredient/:id" element={<IngredientProfilePage />} />
        <Route path="/print" element={<PrintPage />} />
      </Routes>
    </HashRouter>
  );
}
