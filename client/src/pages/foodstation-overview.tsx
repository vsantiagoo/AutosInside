import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Download, 
  TrendingUp, 
  AlertTriangle,
  Package,
  ShoppingCart
} from 'lucide-react';
import type { FoodStationOverviewReport } from '@shared/schema';

export default function FoodStationOverviewPage() {
  const [periodDays, setPeriodDays] = useState<number>(30);

  const { data: report, isLoading } = useQuery<FoodStationOverviewReport>({
    queryKey: ['/api/reports/foodstation/overview', periodDays],
    queryFn: async () => {
      const res = await fetch(`/api/reports/foodstation/overview?days=${periodDays}`);
      if (!res.ok) throw new Error('Failed to fetch FoodStation overview report');
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getRiskBadge = (risk: 'high' | 'medium' | 'low') => {
    if (risk === 'high') return <Badge variant="destructive" data-testid={`badge-risk-high`}>Alto</Badge>;
    if (risk === 'medium') return <Badge variant="secondary" data-testid={`badge-risk-medium`}>Médio</Badge>;
    return <Badge variant="outline" data-testid={`badge-risk-low`}>Baixo</Badge>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground" data-testid="text-page-title">
              Visão Geral - FoodStation
            </h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
              Análise de consumo e previsão de reposição
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={periodDays.toString()} onValueChange={(v) => setPeriodDays(parseInt(v))}>
              <SelectTrigger className="w-[140px]" data-testid="select-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7" data-testid="option-period-7">7 dias</SelectItem>
                <SelectItem value="15" data-testid="option-period-15">15 dias</SelectItem>
                <SelectItem value="30" data-testid="option-period-30">30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : report ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardDescription>Total de Saídas</CardDescription>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-total-exits">
                    {report.kpis.total_exits_month}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {periodDays} dias
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardDescription>Top 5 Consumidos</CardDescription>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-top-consumed">
                    {report.topConsumed.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: {report.topConsumed.reduce((sum, item) => sum + item.total_qty, 0)} unidades
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardDescription>Valor Reposição</CardDescription>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-restock-value">
                    {formatCurrency(report.kpis.total_restock_value)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimativa de compra
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardDescription>Itens Alto Risco</CardDescription>
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive" data-testid="text-kpi-high-risk">
                    {report.kpis.high_risk_items}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Requer atenção urgente
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Top Consumed Products */}
            <Card>
              <CardHeader>
                <CardTitle data-testid="text-top-consumed-title">Top 5 Produtos Mais Consumidos</CardTitle>
                <CardDescription>Produtos com maior saída nos últimos {periodDays} dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {report.topConsumed.map((item, index) => (
                    <div key={item.product_id} className="flex items-center gap-3" data-testid={`item-top-consumed-${index}`}>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" data-testid={`text-product-name-${index}`}>
                          {item.product_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.total_qty} unidades · {formatCurrency(item.total_value)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium" data-testid={`text-product-qty-${index}`}>
                          {item.total_qty}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {((item.total_qty / report.kpis.total_exits_month) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Restock Predictions Table */}
            <Card>
              <CardHeader>
                <CardTitle data-testid="text-restock-title">Previsão de Reposição (15 dias)</CardTitle>
                <CardDescription>
                  Baseado em média de consumo diário com buffer de segurança de 20%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-product">Produto</TableHead>
                        <TableHead className="text-right" data-testid="header-current-stock">Estoque Atual</TableHead>
                        <TableHead className="text-right" data-testid="header-daily-avg">Média Diária</TableHead>
                        <TableHead className="text-right" data-testid="header-predicted-qty">Qtd. Prevista</TableHead>
                        <TableHead className="text-right" data-testid="header-reorder-qty">Qtd. Reposição</TableHead>
                        <TableHead className="text-right" data-testid="header-estimated-cost">Custo Estimado</TableHead>
                        <TableHead className="text-center" data-testid="header-risk">Risco</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.products.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Nenhum produto requer reposição no momento
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.products.map((prediction) => (
                          <TableRow key={prediction.product_id} data-testid={`row-restock-${prediction.product_id}`}>
                            <TableCell className="font-medium" data-testid={`text-product-name-${prediction.product_id}`}>
                              {prediction.product_name}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-current-stock-${prediction.product_id}`}>
                              {prediction.current_stock}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-daily-avg-${prediction.product_id}`}>
                              {prediction.avg_daily_consumption_15d.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-predicted-qty-${prediction.product_id}`}>
                              {prediction.predicted_consumption_15d.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right font-bold" data-testid={`text-reorder-qty-${prediction.product_id}`}>
                              {prediction.recommended_reorder}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-estimated-cost-${prediction.product_id}`}>
                              {formatCurrency(prediction.unit_price * prediction.recommended_reorder)}
                            </TableCell>
                            <TableCell className="text-center" data-testid={`cell-risk-${prediction.product_id}`}>
                              {getRiskBadge(prediction.stockout_risk)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
