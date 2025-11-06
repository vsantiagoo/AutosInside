import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, TrendingDown, ShoppingCart, DollarSign, AlertTriangle, Trophy } from 'lucide-react';
import type { 
  Product, 
  Consumption, 
  ConsumptionWithDetails, 
  ProductWithSector, 
  Sector,
  TopConsumedItem 
} from '@shared/schema';
import { format } from 'date-fns';
import { Link } from 'wouter';

interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  monthlyConsumptions: number;
  totalValue: number;
}

export default function Dashboard() {
  const [selectedSector, setSelectedSector] = useState<string>('all');

  // Fetch sectors for filter
  const { data: sectors = [] } = useQuery<Sector[]>({
    queryKey: ['/api/sectors'],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch dashboard stats with sector filter
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats', selectedSector !== 'all' ? { sector_id: selectedSector } : {}],
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Fetch recent consumptions
  const { data: recentConsumptions, isLoading: consumptionsLoading } = useQuery<ConsumptionWithDetails[]>({
    queryKey: ['/api/consumptions/recent'],
    refetchInterval: 15000, // Auto-refresh every 15 seconds
  });

  // Fetch low stock products with sector filter
  const { data: lowStockProducts, isLoading: lowStockLoading } = useQuery<ProductWithSector[]>({
    queryKey: ['/api/products/low-stock', selectedSector !== 'all' ? { sector_id: selectedSector } : {}],
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Fetch top consumed items
  const { data: topItems, isLoading: topItemsLoading } = useQuery<TopConsumedItem[]>({
    queryKey: ['/api/consumptions/top-items', { limit: 10 }],
    refetchInterval: 15000, // Auto-refresh every 15 seconds
  });

  const statCards = [
    {
      title: 'Total de Produtos',
      value: stats?.totalProducts ?? 0,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      title: 'Alertas de Estoque Baixo',
      value: stats?.lowStockCount ?? 0,
      icon: TrendingDown,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-950',
    },
    {
      title: 'Consumos Mensais',
      value: stats?.monthlyConsumptions ?? 0,
      icon: ShoppingCart,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
    {
      title: 'Valor Total do Inventário',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.totalValue ?? 0),
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-dashboard-title">Painel</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Visão geral do sistema de inventário</p>
        </div>

        <div className="w-full md:w-64">
          <Select value={selectedSector} onValueChange={setSelectedSector}>
            <SelectTrigger data-testid="select-sector-filter">
              <SelectValue placeholder="Filtrar por setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Setores</SelectItem>
              {sectors.map((sector) => (
                <SelectItem key={sector.id} value={sector.id.toString()}>
                  {sector.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} data-testid={`card-${stat.title.toLowerCase().replace(/ /g, '-')}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl md:text-3xl font-bold">{stat.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Low Stock Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Alertas de Estoque Baixo</CardTitle>
            {lowStockProducts && lowStockProducts.length > 0 && (
              <Badge variant="destructive" data-testid="badge-low-stock-count">
                {lowStockProducts.length}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {lowStockLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !lowStockProducts || lowStockProducts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Todos os produtos estão bem estocados</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {lowStockProducts.map((product) => (
                  <Link key={product.id} to="/products">
                    <div 
                      className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-950 rounded-lg hover-elevate border border-orange-200 dark:border-orange-800 cursor-pointer"
                      data-testid={`alert-product-${product.id}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {product.sector_name || 'Sem setor'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="font-semibold text-orange-600">
                          {product.stock_quantity} unidades
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Limite: {product.low_stock_threshold || 10}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Consumed Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Itens Mais Consumidos</CardTitle>
            {topItems && topItems.length > 0 && (
              <Badge variant="secondary" data-testid="badge-top-items-count">
                Top {topItems.length}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {topItemsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !topItems || topItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum consumo registrado ainda</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {topItems.map((item, index) => (
                  <div
                    key={item.product_id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover-elevate"
                    data-testid={`top-item-${item.product_id}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">#{index + 1}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.sector_name || 'Sem setor'} • {item.consumption_count} consumos
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="font-semibold">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total_value)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Qtd: {item.total_qty}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Consumptions */}
      <Card>
        <CardHeader>
          <CardTitle>Consumos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {consumptionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !recentConsumptions || recentConsumptions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum consumo registrado ainda</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentConsumptions.map((consumption) => (
                <div
                  key={consumption.id}
                  className="flex flex-col justify-between p-4 bg-muted/50 rounded-lg hover-elevate"
                  data-testid={`consumption-${consumption.id}`}
                >
                  <div>
                    <p className="font-medium line-clamp-2">{consumption.product_name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {consumption.user_name} • Qtd: {consumption.qty}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <p className="font-semibold text-primary">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(consumption.total_price)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(consumption.consumed_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
