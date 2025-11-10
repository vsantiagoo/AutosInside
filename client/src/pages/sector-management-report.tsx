import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Package, LogIn, LogOut, DollarSign, ShoppingCart, TrendingUp, AlertTriangle } from 'lucide-react';
import type { SectorProductManagementReport, Sector } from '@shared/schema';

export default function SectorManagementReportPage() {
  const { toast } = useToast();

  // Filter states
  const [selectedSectorId, setSelectedSectorId] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<string>('30');
  const [appliedFilters, setAppliedFilters] = useState({
    sectorId: '',
    days: 30,
  });

  // Fetch sectors for dropdown
  const { data: sectors = [] } = useQuery<Sector[]>({
    queryKey: ['/api/sectors'],
    queryFn: async () => {
      const res = await fetch('/api/sectors');
      if (!res.ok) throw new Error('Failed to fetch sectors');
      return res.json();
    },
  });

  // Set default sector when sectors are loaded
  useEffect(() => {
    if (sectors.length > 0 && !selectedSectorId) {
      // Try to find FoodStation first, otherwise use first sector
      const foodStation = sectors.find(s => s.name.toLowerCase().includes('foodstation') || s.name.toLowerCase().includes('alimentos'));
      const defaultSector = foodStation || sectors[0];
      setSelectedSectorId(defaultSector.id.toString());
      setAppliedFilters({
        sectorId: defaultSector.id.toString(),
        days: 30,
      });
    }
  }, [sectors, selectedSectorId]);

  // Fetch management report
  const { data: report, isLoading, error, refetch } = useQuery<SectorProductManagementReport>({
    queryKey: ['/api/reports/sector-management', appliedFilters.sectorId, appliedFilters.days],
    queryFn: async () => {
      const params = new URLSearchParams({
        sectorId: appliedFilters.sectorId,
        days: appliedFilters.days.toString(),
      });
      const res = await fetch(`/api/reports/sector-management?${params}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to fetch sector management report');
      }
      return res.json();
    },
    enabled: !!appliedFilters.sectorId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (error) {
      toast({
        title: 'Erro ao carregar relatório',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const handleFilter = () => {
    setAppliedFilters({
      sectorId: selectedSectorId,
      days: parseInt(selectedDays),
    });
    refetch();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getStockStatusBadge = (daysUntilStockout: number | null) => {
    if (daysUntilStockout === null || daysUntilStockout === Infinity) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">OK</Badge>;
    }
    if (daysUntilStockout <= 7) {
      return <Badge variant="destructive">Crítico</Badge>;
    }
    if (daysUntilStockout <= 14) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Atenção</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">OK</Badge>;
  };

  const currentSector = sectors.find(s => s.id.toString() === appliedFilters.sectorId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground" data-testid="text-page-title">
              Gestão de Produtos - {currentSector?.name || 'Carregando...'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
              Análise de movimentação e previsão de reposição
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1.5 block">Setor</label>
              <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
                <SelectTrigger data-testid="select-sector">
                  <SelectValue placeholder="Selecione um setor" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((sector) => (
                    <SelectItem 
                      key={sector.id} 
                      value={sector.id.toString()}
                      data-testid={`option-sector-${sector.id}`}
                    >
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[180px]">
              <label className="text-sm font-medium mb-1.5 block">Período de Análise</label>
              <Select value={selectedDays} onValueChange={setSelectedDays}>
                <SelectTrigger data-testid="select-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15" data-testid="option-days-15">15 dias</SelectItem>
                  <SelectItem value="30" data-testid="option-days-30">30 dias</SelectItem>
                  <SelectItem value="60" data-testid="option-days-60">60 dias</SelectItem>
                  <SelectItem value="90" data-testid="option-days-90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleFilter} 
              className="min-w-[120px]"
              data-testid="button-filter"
            >
              Filtrar
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : report ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardDescription>Total Produtos</CardDescription>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-total-products">
                    {report.kpis.total_products}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    No setor
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardDescription>Entradas</CardDescription>
                  <LogIn className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-total-entries">
                    {report.kpis.total_entries}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Últimos {appliedFilters.days} dias
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardDescription>Saídas</CardDescription>
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-total-exits">
                    {report.kpis.total_exits}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Últimos {appliedFilters.days} dias
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardDescription>Valor Inventário</CardDescription>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold" data-testid="text-kpi-inventory-value">
                    {formatCurrency(report.kpis.total_inventory_value)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Valor atual
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardDescription>Valor Reposição</CardDescription>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold" data-testid="text-kpi-restock-value">
                    {formatCurrency(report.kpis.total_reorder_value)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimativa pedido
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Top 5 Produtos */}
            {report.topExits.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Top 5 Produtos Mais Saídos
                  </CardTitle>
                  <CardDescription>
                    Últimos {appliedFilters.days} dias
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {report.topExits.map((product, index) => {
                      const maxExits = report.topExits[0]?.total_qty || 1;
                      const progressPercentage = (product.total_qty / maxExits) * 100;
                      
                      return (
                        <div 
                          key={product.product_id} 
                          className="flex items-center gap-3"
                          data-testid={`row-top-product-${product.product_id}`}
                        >
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm" data-testid={`text-top-product-name-${product.product_id}`}>
                                {product.product_name}
                              </span>
                              <span className="text-sm font-semibold" data-testid={`text-top-product-exits-${product.product_id}`}>
                                {product.total_qty} saídas
                              </span>
                            </div>
                            <Progress 
                              value={progressPercentage} 
                              className="h-2"
                              data-testid={`progress-top-product-${product.product_id}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Products Table with Predictions */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento de Produtos e Previsões</CardTitle>
                <CardDescription>
                  Análise detalhada com sugestões de reposição
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.products.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="text-no-products">
                    Nenhum produto encontrado neste setor.
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <Table className="min-w-[1100px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead data-testid="header-product">Produto</TableHead>
                          <TableHead className="text-right" data-testid="header-stock">Estoque</TableHead>
                          <TableHead className="text-right" data-testid="header-entries">Entradas</TableHead>
                          <TableHead className="text-right" data-testid="header-exits">Saídas</TableHead>
                          <TableHead className="text-right" data-testid="header-avg">Média/Dia</TableHead>
                          <TableHead className="text-center" data-testid="header-days">Dias p/ Zerado</TableHead>
                          <TableHead className="text-right" data-testid="header-order-qty">Qtd Pedido</TableHead>
                          <TableHead data-testid="header-order-date">Data Pedido</TableHead>
                          <TableHead className="text-center" data-testid="header-status">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.products.map((product) => (
                          <TableRow key={product.product_id} data-testid={`row-product-${product.product_id}`}>
                            <TableCell className="font-medium" data-testid={`text-product-name-${product.product_id}`}>
                              {product.product_name}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-stock-${product.product_id}`}>
                              {product.current_stock}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-entries-${product.product_id}`}>
                              {product.total_entries}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-exits-${product.product_id}`}>
                              {product.total_exits}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-avg-${product.product_id}`}>
                              {product.avg_daily_consumption_30d.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center" data-testid={`text-days-${product.product_id}`}>
                              {product.days_until_stockout === null || product.days_until_stockout === Infinity 
                                ? '∞' 
                                : Math.round(product.days_until_stockout)}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-order-qty-${product.product_id}`}>
                              {product.recommended_reorder}
                            </TableCell>
                            <TableCell data-testid={`text-order-date-${product.product_id}`}>
                              {formatDate(product.next_order_date)}
                            </TableCell>
                            <TableCell className="text-center" data-testid={`badge-status-${product.product_id}`}>
                              {getStockStatusBadge(product.days_until_stockout)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
