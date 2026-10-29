import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import History from "./pages/History";
import PurchaseEdit from "./pages/PurchaseEdit";
import ReceiptImport from "./pages/ReceiptImport";
import Lists from "./pages/Lists";
import ListDetail from "./pages/ListDetail";
import Planning from "./pages/Planning";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Settings from "./pages/Settings";
import Statistics from "./pages/Statistics";
import Supermarket from "./pages/Supermarket";
import Tutorial from "./pages/Tutorial";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/history" element={<History />} />
      <Route path="/history/:id" element={<PurchaseEdit />} />
      <Route path="/import" element={<ReceiptImport />} />
      <Route path="/lists" element={<Lists />} />
      <Route path="/lists/:id" element={<ListDetail />} />
      <Route path="/planning" element={<Planning />} />
      <Route path="/products" element={<Products />} />
      <Route path="/products/:id" element={<ProductDetail />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/statistics" element={<Statistics />} />
      <Route path="/supermarket" element={<Supermarket />} />
      <Route path="/tutorial" element={<Tutorial />} />
      <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
