import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { Toaster } from "sonner";
import App from "./App";
import { TipProvider } from "./components/ui";
import { queryClient } from "./lib/api";
import "./index.css";

try { if (localStorage.getItem("theme") === "dark") document.documentElement.classList.add("dark"); } catch { /* ignore */ }

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TipProvider>
        <BrowserRouter>
          <App />
          <Toaster position="top-center" richColors closeButton />
        </BrowserRouter>
      </TipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
