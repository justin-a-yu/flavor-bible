import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ExplorerPage from './pages/ExplorerPage';
import IngredientProfilePage from './pages/IngredientProfilePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ExplorerPage />} />
        <Route path="/ingredient/:id" element={<IngredientProfilePage />} />
      </Routes>
    </BrowserRouter>
  );
}
