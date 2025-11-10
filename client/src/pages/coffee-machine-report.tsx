import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CoffeeMachineReport } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Package, TrendingUp, DollarSign, AlertTriangle, Calendar } from "lucide-react";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getFrequencyBadge = (frequency: 'high' | 'medium' | 'low') => {
  const variants = {
    high: { label: 'Alta', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
    medium: { label: 'Média', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' },
    low: { label: 'Baixa', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' },
  };
  const variant = variants[frequency];
  return <Badge className={variant.className} data-testid={`badge-frequency-${frequency}`}>{variant.label}</Badge>;
};

const getCadenceBadge = (cadence: 'weekly' | 'biweekly' | 'monthly') => {
  const labels = {
    weekly: 'Semanal',
    biweekly: 'Quinzenal',
    monthly: 'Mensal',
  };
  return <Badge variant="outline" data-testid={`badge-cadence-${cadence}`}>{labels[cadence]}</Badge>;
};

export default function CoffeeMachineReport() {
  const [cadence, setCadence] = useState<'weekly' | 'biweekly'>('weekly');
  const [weeks, setWeeks] = useState('4');

  const { data: report, isLoading, refetch } = useQuery<CoffeeMachineReport>({
    queryKey: ['/api/reports/sector/coffee', cadence, weeks],
    queryFn: async () => {
      const params = new URLSearchParams({ cadence, weeks });
      const res = await fetch(`/api/reports/sector/coffee?${params}`);
      if (!res.ok) throw new Error('Failed to fetch coffee machine report');
      return res.json();
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    refetch();
  }, [cadence, weeks, refetch]);

  const chartData = report?.topConsumed.map(item => ({
    name: item.product_name.length > 15 ? item.product_name.substring(0, 15) + '...' : item.product_name,
    quantidade: item.total_qty,
  })) || [];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">
            Relatório - Máquina de Café
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Cadência</label>
              <Select value={cadence} onValueChange={(v: any) => setCadence(v)} data-testid="select-cadence">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="biweekly">Quinzenal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Número de Semanas</label>
              <Input
                type="number"
                min="1"
                max="12"
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
                data-testid="input-weeks"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="text-muted-foreground">Carregando relatório...</div>
          </div>
        ) : report ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-total-products">{report.kpis.total_products}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Saídas</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-total-exits">{report.kpis.total_exits}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-total-value">{formatCurrency(report.kpis.total_value_exits)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Itens Alta Frequência</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-high-frequency">{report.kpis.high_frequency_items}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Média Semanal</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-avg-weekly">{report.kpis.avg_weekly_consumption.toFixed(1)}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle data-testid="text-chart-title">Produtos Mais Utilizados</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="quantidade" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle data-testid="text-table-title">Produtos - Controle de Consumo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-product">Produto</TableHead>
                        <TableHead className="text-right" data-testid="header-stock">Estoque Atual</TableHead>
                        <TableHead className="text-right" data-testid="header-weekly-avg">Média Semanal</TableHead>
                        <TableHead className="text-right" data-testid="header-biweekly-avg">Média Quinzenal</TableHead>
                        <TableHead className="text-center" data-testid="header-frequency">Frequência</TableHead>
                        <TableHead className="text-center" data-testid="header-cadence">Cadência Sugerida</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.products.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Nenhum produto encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.products.map((product) => (
                          <TableRow key={product.product_id} data-testid={`row-product-${product.product_id}`}>
                            <TableCell className="font-medium" data-testid={`text-product-name-${product.product_id}`}>
                              {product.product_name}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-stock-${product.product_id}`}>
                              {product.current_stock}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-weekly-avg-${product.product_id}`}>
                              {product.weekly_avg_consumption.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-biweekly-avg-${product.product_id}`}>
                              {product.biweekly_avg_consumption.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center" data-testid={`cell-frequency-${product.product_id}`}>
                              {getFrequencyBadge(product.consumption_frequency)}
                            </TableCell>
                            <TableCell className="text-center" data-testid={`cell-cadence-${product.product_id}`}>
                              {getCadenceBadge(product.suggested_reorder_cadence)}
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
