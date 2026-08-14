import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import OAuthConsent from "./pages/OAuthConsent";
import Accounts from "./pages/Accounts";
import Transfers from "./pages/Transfers";
import BillPay from "./pages/BillPay";
import Cards from "./pages/Cards";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import AdminSupport from "./pages/AdminSupport";
import AdminInvitations from "./pages/AdminInvitations";
import AdminUsers from "./pages/AdminUsers";
import AdminTransactions from "./pages/AdminTransactions";
import AdminAnnouncements from "./pages/AdminAnnouncements";
import AdminAuditLog from "./pages/AdminAuditLog";
import AdminResendPin from "./pages/AdminResendPin";
import Locations from "./pages/Locations";

import NotFound from "./pages/NotFound";

import WillVsTrust from "./pages/WillVsTrust";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import { UiThemeProvider } from "./contexts/UiThemeContext";
import { AppLock } from "./components/AppLock";
import { DeviceFrame } from "./components/DeviceFrame";
import { DeviceBlockedNotice } from "./components/DeviceBlockedNotice";

import { HelmetProvider } from "react-helmet-async";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <CurrencyProvider>
      <UiThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <DeviceFrame />
        <DeviceBlockedNotice />

        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AppLock>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/insights/will-vs-trust" element={<WillVsTrust />} />
            <Route path="/" element={<Navigate to="/accounts" replace />} />
            <Route path="/overview" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
            <Route path="/transfers" element={<ProtectedRoute><Transfers /></ProtectedRoute>} />
            <Route path="/billpay" element={<ProtectedRoute><BillPay /></ProtectedRoute>} />
            <Route path="/cards" element={<ProtectedRoute><Cards /></ProtectedRoute>} />
            <Route path="/locations" element={<ProtectedRoute><Locations /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
            <Route path="/admin/support" element={<ProtectedRoute><AdminSupport /></ProtectedRoute>} />
            <Route path="/admin/invitations" element={<ProtectedRoute><AdminInvitations /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/transactions" element={<ProtectedRoute><AdminTransactions /></ProtectedRoute>} />
            <Route path="/admin/announcements" element={<ProtectedRoute><AdminAnnouncements /></ProtectedRoute>} />
            <Route path="/admin/audit" element={<ProtectedRoute><AdminAuditLog /></ProtectedRoute>} />
            <Route path="/admin/resend-pin" element={<ProtectedRoute><AdminResendPin /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}

            <Route path="*" element={<NotFound />} />
          </Routes>
          </AppLock>
        </BrowserRouter>
      </TooltipProvider>
      </UiThemeProvider>
    </CurrencyProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
