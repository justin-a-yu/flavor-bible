import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ExplorerPage from './pages/ExplorerPage';
import IngredientProfilePage from './pages/IngredientProfilePage';
import PrintPage from './pages/PrintPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ExplorerPage />} />
        <Route path="/ingredient/:id" element={<IngredientProfilePage />} />
        <Route path="/print" element={<PrintPage />} />
      </Routes>
    </BrowserRouter>
  );
}
