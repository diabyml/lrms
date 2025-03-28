// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom"; // Import BrowserRouter
import App from "./App.tsx";
import "./index.css"; // Or your main CSS file

import { Toaster } from "@/components/ui/sonner.tsx"; // Import from sonner

import { AuthProvider } from "./context/AuthContext"; // Import AuthProvider

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Wrap the App component with BrowserRouter */}
    <BrowserRouter>
      <AuthProvider>
        <Toaster richColors position="top-right" /> {/* Add Toaster here */}
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
