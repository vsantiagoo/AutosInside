import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import LoginUser from "@/pages/login-user";
import AdminLogin from "@/pages/admin-login";
import Dashboard from "@/pages/dashboard";
import Products from "@/pages/products";
import StockTransactions from "@/pages/stock-transactions";
import Consumptions from "@/pages/consumptions";
import FoodStation from "@/pages/food-station";
import MyConsumptionReport from "@/pages/my-consumption-report";
import ConsumptionLimit from "@/pages/consumption-limit";
import AdminUsers from "@/pages/admin-users";
import AdminSectors from "@/pages/admin-sectors";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/", { replace: true });
    } else if (!isLoading && adminOnly && user?.role !== 'admin') {
      navigate("/food-station", { replace: true });
    }
  }, [isLoading, user, adminOnly, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (adminOnly && user.role !== 'admin') {
    return null;
  }

  return <>{children}</>;
}

function AppRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Unauthenticated users see login pages
  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<LoginUser />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Authenticated users see the full app with sidebar
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-4 h-16 border-b bg-background">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="material-icons text-base">inventory_2</span>
                <span className="font-medium text-foreground">Gestão de Inventário</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <div className="text-sm font-medium">{user?.full_name}</div>
                <div className="text-xs text-muted-foreground">{user?.role === 'admin' ? 'Administrador' : 'Usuário'}</div>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6 bg-background">
            <div className="max-w-7xl mx-auto">
              <Routes>
                <Route path="/" element={<Navigate to={user.role === 'admin' ? "/dashboard" : "/food-station"} replace />} />
                <Route path="/admin-login" element={<Navigate to={user.role === 'admin' ? "/dashboard" : "/food-station"} replace />} />
                <Route path="/dashboard" element={<ProtectedRoute adminOnly={true}><Dashboard /></ProtectedRoute>} />
                <Route path="/products" element={<ProtectedRoute adminOnly={true}><Products /></ProtectedRoute>} />
                <Route path="/stock" element={<ProtectedRoute adminOnly={true}><StockTransactions /></ProtectedRoute>} />
                <Route path="/consumptions" element={<ProtectedRoute adminOnly={true}><Consumptions /></ProtectedRoute>} />
                <Route path="/food-station" element={<FoodStation />} />
                <Route path="/my-consumption-report" element={<ProtectedRoute><MyConsumptionReport /></ProtectedRoute>} />
                <Route path="/consumption-limit" element={<ProtectedRoute><ConsumptionLimit /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute adminOnly={true}><AdminUsers /></ProtectedRoute>} />
                <Route path="/admin/sectors" element={<ProtectedRoute adminOnly={true}><AdminSectors /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to={user.role === 'admin' ? "/dashboard" : "/food-station"} replace />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
