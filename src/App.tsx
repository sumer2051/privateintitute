import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Accounts from "./pages/Accounts";
import Transfers from "./pages/Transfers";
import BillPay from "./pages/BillPay";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<Navigate to="/accounts" replace />} />
          <Route path="/overview" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
          <Route path="/transfers" element={<ProtectedRoute><Transfers /></ProtectedRoute>} />
          <Route path="/billpay" element={<ProtectedRoute><BillPay /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
