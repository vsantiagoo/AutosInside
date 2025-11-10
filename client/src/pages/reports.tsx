import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  Package,
  Coffee,
  UtensilsCrossed,
  FileBarChart,
  ArrowRight,
  Users
} from 'lucide-react';
import type { 
  RestockPredictionReport, 
  UserConsumptionReport,
  SectorMonthlyReport,
  Sector
} from '@shared/schema';

export default function ReportsPage() {
  const navigate = useNavigate();
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [selectedCadence, setSelectedCadence] = useState<'monthly' | 'biweekly' | 'weekly'>('monthly');

  // Fetch sectors for dropdowns
  const { data: sectors = [] } = useQuery<Sector[]>({
    queryKey: ['/api/sectors'],
  });

  // Fetch FoodStation Restock Report
  const { data: restockReport, isLoading: isLoadingRestock } = useQuery<RestockPredictionReport>({
    queryKey: ['/api/reports/foodstation/restock'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch User Consumption Report
  const { data: consumptionReport, isLoading: isLoadingConsumption } = useQuery<UserConsumptionReport>({
    queryKey: ['/api/reports/foodstation/consumption'],
    refetchInterval: 60000,
  });

  // Fetch Sector Monthly Report
  const { data: sectorReport, isLoading: isLoadingSector } = useQuery<SectorMonthlyReport | null>({
    queryKey: ['/api/reports/sector', selectedSector, 'monthly', selectedCadence],
    queryFn: selectedSector 
      ? async () => {
          const res = await fetch(`/api/reports/sector/${selectedSector}/monthly?cadence=${selectedCadence}`);
          if (!res.ok) throw new Error('Failed to fetch sector report');
          return res.json();
        }
      : undefined,
    enabled: !!selectedSector,
    refetchInterval: 60000,
  });

  const handleExportRestock = () => {
    window.open('/api/reports/foodstation/restock/export', '_blank');
  };

  const handleExportConsumption = () => {
    window.open('/api/reports/foodstation/consumption/export', '_blank');
  };

  const handleExportSector = () => {
    if (selectedSector) {
      window.open(`/api/reports/sector/${selectedSector}/monthly/export?cadence=${selectedCadence}`, '_blank');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getTrendIcon = (trend: 'increasing' | 'stable' | 'decreasing') => {
    if (trend === 'increasing') return <TrendingUp className="h-4 w-4 text-orange-500" />;
    if (trend === 'decreasing') return <TrendingDown className="h-4 w-4 text-blue-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getRiskBadge = (risk: 'high' | 'medium' | 'low') => {
    if (risk === 'high') return <Badge variant="destructive" data-testid={`badge-risk-high`}>Alto</Badge>;
    if (risk === 'medium') return <Badge variant="secondary" data-testid={`badge-risk-medium`}>Médio</Badge>;
    return <Badge variant="outline" data-testid={`badge-risk-low`}>Baixo</Badge>;
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    if (confidence === 'high') return <Badge variant="default" data-testid={`badge-confidence-high`}>Alta</Badge>;
    if (confidence === 'medium') return <Badge variant="secondary" data-testid={`badge-confidence-medium`}>Média</Badge>;
    return <Badge variant="outline" data-testid={`badge-confidence-low`}>Baixa</Badge>;
  };

  const getPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    if (priority === 'high') return <Badge variant="destructive" data-testid={`badge-priority-high`}>Alta</Badge>;
    if (priority === 'medium') return <Badge variant="secondary" data-testid={`badge-priority-medium`}>Média</Badge>;
    return <Badge variant="outline" data-testid={`badge-priority-low`}>Baixa</Badge>;
  };

  const reportCards = [
    {
      title: "Visão Geral FoodStation",
      description: "Análise completa com KPIs, produtos mais consumidos e previsão de reposição",
      icon: UtensilsCrossed,
      path: "/foodstation-overview",
      color: "text-orange-500",
    },
    {
      title: "Máquina de Café",
      description: "Monitoramento semanal/quinzenal com análise de frequência de consumo",
      icon: Coffee,
      path: "/coffee-machine-report",
      color: "text-amber-600",
    },
    {
      title: "Inventário Geral",
      description: "Visão consolidada de todos os produtos com filtros, gráficos e exportação",
      icon: FileBarChart,
      path: "/general-inventory",
      color: "text-blue-500",
    },
    {
      title: "Controle de Consumo FoodStation",
      description: "Relatório detalhado de consumos por usuário com filtro de período e totalizações",
      icon: Users,
      path: "/foodstation-consumption-control",
      color: "text-green-500",
    },
    {
      title: "Gestão de Produtos por Setor",
      description: "Movimentação, previsões e recomendações de pedido para todos os setores",
      icon: Package,
      path: "/sector-management-report",
      color: "text-purple-500",
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-card p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground" data-testid="text-page-title">
          Relatórios
        </h1>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
          Central de relatórios e análises do sistema
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {/* Report Cards Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4" data-testid="text-reports-section">
            Relatórios Disponíveis
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportCards.map((report) => (
              <Card 
                key={report.path} 
                className="hover-elevate cursor-pointer transition-all"
                onClick={() => navigate(report.path)}
                data-testid={`card-report-${report.path.replace('/', '')}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <report.icon className={`h-8 w-8 ${report.color}`} />
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <CardTitle className="mt-4">{report.title}</CardTitle>
                  <CardDescription>{report.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
        <Tabs defaultValue="foodstation-restock" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 mb-6" data-testid="tabs-reports">
            <TabsTrigger value="foodstation-restock" data-testid="tab-foodstation-restock">
              Reposição FoodStation
            </TabsTrigger>
            <TabsTrigger value="user-consumption" data-testid="tab-user-consumption">
              Meu Consumo
            </TabsTrigger>
            <TabsTrigger value="sector-monthly" data-testid="tab-sector-monthly">
              Relatórios de Setor
            </TabsTrigger>
            <TabsTrigger value="inventory-general" data-testid="tab-inventory-general">
              Visão Geral
            </TabsTrigger>
          </TabsList>

          {/* FoodStation Restock Tab */}
          <TabsContent value="foodstation-restock" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle data-testid="text-restock-title">Previsão de Reposição - FoodStation</CardTitle>
                    <CardDescription data-testid="text-restock-description">
                      Análise preditiva de 15 dias com recomendações automáticas
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={handleExportRestock} 
                    variant="outline"
                    disabled={isLoadingRestock}
                    data-testid="button-export-restock"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingRestock ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : restockReport ? (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Total de Produtos</CardDescription>
                          <CardTitle className="text-2xl" data-testid="text-total-products">
                            {restockReport.products.length}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Itens Recomendados</CardDescription>
                          <CardTitle className="text-2xl text-orange-600" data-testid="text-recommended-items">
                            {restockReport.totalRecommendedItems}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Alto Risco</CardDescription>
                          <CardTitle className="text-2xl text-red-600" data-testid="text-high-risk-items">
                            {restockReport.highRiskItems}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Período Análise</CardDescription>
                          <CardTitle className="text-sm" data-testid="text-analysis-period">
                            {new Date(restockReport.periodAnalyzed.start).toLocaleDateString('pt-BR')} - {new Date(restockReport.periodAnalyzed.end).toLocaleDateString('pt-BR')}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    </div>

                    {/* Products Table */}
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead data-testid="header-product">Produto</TableHead>
                            <TableHead className="text-center" data-testid="header-stock">Estoque</TableHead>
                            <TableHead className="text-center" data-testid="header-daily-avg">Média/Dia</TableHead>
                            <TableHead className="text-center" data-testid="header-trend">Tendência</TableHead>
                            <TableHead className="text-center" data-testid="header-predicted">Previsão 15d</TableHead>
                            <TableHead className="text-center" data-testid="header-reorder">Recomendação</TableHead>
                            <TableHead className="text-center" data-testid="header-risk">Risco</TableHead>
                            <TableHead className="text-center" data-testid="header-confidence">Confiança</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {restockReport.products.map((product) => (
                            <TableRow key={product.productId} data-testid={`row-product-${product.productId}`}>
                              <TableCell className="font-medium" data-testid={`text-product-name-${product.productId}`}>
                                <div className="flex items-center gap-2">
                                  {product.photoPath ? (
                                    <img 
                                      src={product.photoPath} 
                                      alt={product.productName}
                                      className="w-8 h-8 rounded object-cover"
                                      data-testid={`img-product-${product.productId}`}
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                      <Package className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  {product.productName}
                                </div>
                              </TableCell>
                              <TableCell className="text-center" data-testid={`text-stock-${product.productId}`}>
                                {product.currentStock}
                              </TableCell>
                              <TableCell className="text-center" data-testid={`text-daily-avg-${product.productId}`}>
                                {product.averageDailyConsumption.toFixed(1)}
                              </TableCell>
                              <TableCell className="text-center" data-testid={`icon-trend-${product.productId}`}>
                                <div className="flex items-center justify-center">
                                  {getTrendIcon(product.consumptionTrend)}
                                </div>
                              </TableCell>
                              <TableCell className="text-center" data-testid={`text-predicted-${product.productId}`}>
                                {product.predicted15DaysConsumption}
                              </TableCell>
                              <TableCell className="text-center font-semibold" data-testid={`text-reorder-${product.productId}`}>
                                {product.recommendedReorder > 0 ? product.recommendedReorder : '-'}
                              </TableCell>
                              <TableCell className="text-center" data-testid={`badge-risk-${product.productId}`}>
                                {getRiskBadge(product.stockoutRisk)}
                              </TableCell>
                              <TableCell className="text-center" data-testid={`badge-confidence-${product.productId}`}>
                                {getConfidenceBadge(product.confidenceLevel)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8" data-testid="text-no-data">
                    Nenhum dado disponível
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Consumption Tab */}
          <TabsContent value="user-consumption" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle data-testid="text-consumption-title">Meu Consumo Mensal</CardTitle>
                    <CardDescription data-testid="text-consumption-description">
                      Histórico detalhado do seu consumo no FoodStation
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={handleExportConsumption} 
                    variant="outline"
                    disabled={isLoadingConsumption}
                    data-testid="button-export-consumption"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingConsumption ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : consumptionReport ? (
                  <>
                    {/* Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Total Consumido</CardDescription>
                          <CardTitle className="text-2xl" data-testid="text-total-consumed">
                            {formatCurrency(consumptionReport.monthlyTotal)}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Total de Itens</CardDescription>
                          <CardTitle className="text-2xl" data-testid="text-total-items">
                            {consumptionReport.consumptions.length}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Período</CardDescription>
                          <CardTitle className="text-sm" data-testid="text-consumption-period">
                            {new Date(consumptionReport.period.start).toLocaleDateString('pt-BR')} - {new Date(consumptionReport.period.end).toLocaleDateString('pt-BR')}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    </div>

                    {/* Consumptions Table */}
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead data-testid="header-date">Data/Hora</TableHead>
                            <TableHead data-testid="header-product-consumption">Produto</TableHead>
                            <TableHead className="text-right" data-testid="header-qty">Quantidade</TableHead>
                            <TableHead className="text-right" data-testid="header-price">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {consumptionReport.consumptions.map((consumption, index) => (
                            <TableRow key={consumption.id} data-testid={`row-consumption-${index}`}>
                              <TableCell data-testid={`text-date-${index}`}>
                                {new Date(consumption.consumed_at).toLocaleString('pt-BR')}
                              </TableCell>
                              <TableCell data-testid={`text-product-consumption-${index}`}>
                                {consumption.product_name}
                              </TableCell>
                              <TableCell className="text-right" data-testid={`text-qty-${index}`}>
                                {consumption.qty}
                              </TableCell>
                              <TableCell className="text-right font-medium" data-testid={`text-price-${index}`}>
                                {formatCurrency(consumption.total_price)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8" data-testid="text-no-consumption-data">
                    Nenhum dado disponível
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sector Monthly Tab */}
          <TabsContent value="sector-monthly" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle data-testid="text-sector-title">Relatórios de Setor</CardTitle>
                      <CardDescription data-testid="text-sector-description">
                        Análise de consumo e recomendações de compra por setor
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={handleExportSector} 
                      variant="outline"
                      disabled={!selectedSector || isLoadingSector}
                      data-testid="button-export-sector"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </Button>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Select value={selectedSector} onValueChange={setSelectedSector}>
                      <SelectTrigger className="w-full sm:w-64" data-testid="select-sector">
                        <SelectValue placeholder="Selecione um setor" />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map((sector) => (
                          <SelectItem key={sector.id} value={sector.id.toString()} data-testid={`option-sector-${sector.id}`}>
                            {sector.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedCadence} onValueChange={(value: any) => setSelectedCadence(value)}>
                      <SelectTrigger className="w-full sm:w-48" data-testid="select-cadence">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly" data-testid="option-weekly">Semanal</SelectItem>
                        <SelectItem value="biweekly" data-testid="option-biweekly">Quinzenal</SelectItem>
                        <SelectItem value="monthly" data-testid="option-monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!selectedSector ? (
                  <p className="text-center text-muted-foreground py-8" data-testid="text-select-sector">
                    Selecione um setor para visualizar o relatório
                  </p>
                ) : isLoadingSector ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : sectorReport ? (
                  <>
                    {/* Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Consumo Total</CardDescription>
                          <CardTitle className="text-2xl" data-testid="text-sector-consumption">
                            {formatCurrency(sectorReport.totalConsumption)}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardDescription>Itens Consumidos</CardDescription>
                          <CardTitle className="text-2xl" data-testid="text-sector-items">
                            {sectorReport.totalItemsConsumed}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    </div>

                    {/* Purchase Recommendations */}
                    {sectorReport.recommendedPurchases.length > 0 && (
                      <>
                        <h3 className="text-lg font-semibold mb-3" data-testid="text-recommendations-title">
                          Recomendações de Compra
                        </h3>
                        <div className="rounded-md border overflow-x-auto mb-6">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead data-testid="header-product-sector">Produto</TableHead>
                                <TableHead className="text-center" data-testid="header-current">Atual</TableHead>
                                <TableHead className="text-center" data-testid="header-recommended">Recomendado</TableHead>
                                <TableHead className="text-right" data-testid="header-cost">Custo</TableHead>
                                <TableHead className="text-center" data-testid="header-priority">Prioridade</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sectorReport.recommendedPurchases.map((rec) => (
                                <TableRow key={rec.productId} data-testid={`row-recommendation-${rec.productId}`}>
                                  <TableCell className="font-medium" data-testid={`text-rec-product-${rec.productId}`}>
                                    <div className="flex items-center gap-2">
                                      {rec.photoPath ? (
                                        <img 
                                          src={rec.photoPath} 
                                          alt={rec.productName}
                                          className="w-8 h-8 rounded object-cover"
                                          data-testid={`img-rec-product-${rec.productId}`}
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                                          <Package className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                      )}
                                      {rec.productName}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center" data-testid={`text-rec-current-${rec.productId}`}>
                                    {rec.currentStock}
                                  </TableCell>
                                  <TableCell className="text-center font-semibold" data-testid={`text-rec-qty-${rec.productId}`}>
                                    {rec.recommendedQuantity}
                                  </TableCell>
                                  <TableCell className="text-right" data-testid={`text-rec-cost-${rec.productId}`}>
                                    {formatCurrency(rec.estimatedCost)}
                                  </TableCell>
                                  <TableCell className="text-center" data-testid={`badge-priority-${rec.productId}`}>
                                    {getPriorityBadge(rec.priority)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8" data-testid="text-no-sector-data">
                    Nenhum dado disponível
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory General Tab (Placeholder) */}
          <TabsContent value="inventory-general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle data-testid="text-general-title">Visão Geral do Inventário</CardTitle>
                <CardDescription data-testid="text-general-description">
                  Análise consolidada de todos os setores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Calendar className="h-16 w-16 text-muted-foreground" />
                  <p className="text-center text-muted-foreground" data-testid="text-coming-soon">
                    Em desenvolvimento - em breve disponível
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
