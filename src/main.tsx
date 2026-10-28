import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthGate } from "./lib/auth";
import "./styles/global.css";

const queryClient = new QueryClient();
const missingEnv = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (missingEnv) {
  root.render(
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>MeuSuper</h1>
      <p>Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Cadastre-as no painel da Vercel e faça um novo deploy.</p>
    </main>
  );
} else {
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthGate>
            <App />
          </AuthGate>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
}
