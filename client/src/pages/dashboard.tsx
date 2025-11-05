import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Package, TrendingDown, ShoppingCart, DollarSign, AlertTriangle } from 'lucide-react';
import type { Product, Consumption, ConsumptionWithDetails, ProductWithSector } from '@shared/schema';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  monthlyConsumptions: number;
  totalValue: number;
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  const { data: recentConsumptions, isLoading: consumptionsLoading } = useQuery<ConsumptionWithDetails[]>({
    queryKey: ['/api/consumptions/recent'],
  });

  const { data: lowStockProducts, isLoading: lowStockLoading } = useQuery<ProductWithSector[]>({
    queryKey: ['/api/products/low-stock'],
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
      value: `R$${(stats?.totalValue ?? 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-950',
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Painel</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">Visão geral do sistema de inventário</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} data-testid={`card-${stat.title.toLowerCase().replace(/ /g, '-')}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Alertas de Estoque Baixo</CardTitle>
            {lowStockProducts && lowStockProducts.length > 0 && (
              <Badge variant="destructive">{lowStockProducts.length}</Badge>
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
              <div className="space-y-3">
                {lowStockProducts.slice(0, 5).map((product) => (
                  <Link key={product.id} href="/products">
                    <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-950 rounded-lg hover-elevate border border-orange-200 dark:border-orange-800 cursor-pointer">
                      <div className="flex items-center gap-3 flex-1">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.sector_name || 'Sem setor'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
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

        <Card>
          <CardHeader>
            <CardTitle>Consumos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {consumptionsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !recentConsumptions || recentConsumptions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum consumo registrado ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentConsumptions.map((consumption) => (
                  <div
                    key={consumption.id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover-elevate"
                    data-testid={`consumption-${consumption.id}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium">{consumption.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {consumption.user_name} • Qtd: {consumption.qty}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R${consumption.total_price.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(consumption.consumed_at), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
