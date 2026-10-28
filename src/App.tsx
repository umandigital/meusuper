import { Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import History from "./pages/History";
import Lists from "./pages/Lists";
import ListDetail from "./pages/ListDetail";
import Planning from "./pages/Planning";
import Products from "./pages/Products";
import Settings from "./pages/Settings";
import Statistics from "./pages/Statistics";
import Supermarket from "./pages/Supermarket";
import Tutorial from "./pages/Tutorial";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/history" element={<History />} />
      <Route path="/lists" element={<Lists />} />
      <Route path="/lists/:id" element={<ListDetail />} />
      <Route path="/planning" element={<Planning />} />
      <Route path="/products" element={<Products />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/statistics" element={<Statistics />} />
      <Route path="/supermarket" element={<Supermarket />} />
      <Route path="/tutorial" element={<Tutorial />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
