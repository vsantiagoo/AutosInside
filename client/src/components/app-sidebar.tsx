import { 
  LayoutDashboard, 
  Package, 
  History, 
  ShoppingCart, 
  Users, 
  FolderTree,
  LogOut,
  UtensilsCrossed,
  FileText,
  DollarSign
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function AppSidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const adminMainItems = [
    {
      title: "Painel",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Produtos",
      url: "/products",
      icon: Package,
    },
    {
      title: "Movimentações de Estoque",
      url: "/stock",
      icon: History,
    },
    {
      title: "Consumos",
      url: "/consumptions",
      icon: ShoppingCart,
    },
    {
      title: "Estação de Alimentos",
      url: "/food-station",
      icon: UtensilsCrossed,
    },
  ];

  const userMainItems = [
    {
      title: "Estação de Alimentos",
      url: "/food-station",
      icon: UtensilsCrossed,
    },
    {
      title: "Relatório de Consumo",
      url: "/my-consumption-report",
      icon: FileText,
    },
    {
      title: "Limitação de Consumo",
      url: "/consumption-limit",
      icon: DollarSign,
    },
  ];

  const mainItems = user?.role === 'admin' ? adminMainItems : userMainItems;

  const adminItems = user?.role === 'admin' ? [
    {
      title: "Usuários",
      url: "/admin/users",
      icon: Users,
    },
    {
      title: "Setores",
      url: "/admin/sectors",
      icon: FolderTree,
    },
  ] : [];

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold px-4 py-4">
            <span className="material-icons text-primary mr-2 align-middle">inventory_2</span>
            Inventário
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <Link to={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminItems.length > 0 && (
          <>
            <Separator className="my-2" />
            <SidebarGroup>
              <SidebarGroupLabel>Administração</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location.pathname === item.url}
                        data-testid={`link-${item.title.toLowerCase().replace(' ', '-')}`}
                      >
                        <Link to={item.url}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex flex-col gap-3">
          <div className="px-2 py-1 bg-muted rounded-md">
            <div className="text-xs text-muted-foreground">Conectado como</div>
            <div className="text-sm font-medium truncate">{user?.full_name}</div>
            <div className="text-xs text-muted-foreground font-mono">{user?.matricula}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            className="w-full"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
