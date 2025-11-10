import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { GeneralInventoryReport } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Package, Building2, DollarSign, AlertTriangle, AlertCircle, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#8DD1E1'];

const getStatusBadge = (status: 'OK' | 'Baixo' | 'Zerado' | 'Crítico') => {
  const variants = {
    OK: { label: 'OK', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' },
    Baixo: { label: 'Baixo', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' },
    Zerado: { label: 'Zerado', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' },
    Crítico: { label: 'Crítico', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100' },
  };
  const variant = variants[status];
  return <Badge className={variant.className} data-testid={`badge-status-${status.toLowerCase()}`}>{variant.label}</Badge>;
};

export default function GeneralInventory() {
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [includeOutOfStock, setIncludeOutOfStock] = useState(true);
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  // Debounce keyword
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
    }, 500);
    return () => clearTimeout(timer);
  }, [keyword]);

  // Fetch sectors for filter
  const { data: sectors = [] } = useQuery({
    queryKey: ['/api/sectors'],
    queryFn: async () => {
      const res = await fetch('/api/sectors');
      if (!res.ok) throw new Error('Failed to fetch sectors');
      return res.json();
    },
  });

  const { data: report, isLoading, refetch } = useQuery<GeneralInventoryReport>({
    queryKey: ['/api/reports/inventory/general-new', selectedSector, debouncedKeyword, includeOutOfStock],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(selectedSector && selectedSector !== 'all' && { sectorId: selectedSector }),
        ...(debouncedKeyword && { keyword: debouncedKeyword }),
        includeOutOfStock: String(includeOutOfStock),
      });
      const res = await fetch(`/api/reports/inventory/general-new?${params}`);
      if (!res.ok) throw new Error('Failed to fetch general inventory report');
      return res.json();
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    refetch();
  }, [selectedSector, debouncedKeyword, includeOutOfStock, refetch]);

  const pieChartData = report?.bySector.map(sector => ({
    name: sector.sector_name,
    value: sector.total_value,
  })) || [];

  const barChartData = report?.bySector.map(sector => ({
    name: sector.sector_name.length > 15 ? sector.sector_name.substring(0, 15) + '...' : sector.sector_name,
    valor: sector.total_value,
  })) || [];

  const exportToExcel = async () => {
    if (!report) return;

    const workbook = new ExcelJS.Workbook();

    // Summary sheet
    const summarySheet = workbook.addWorksheet('Resumo');
    summarySheet.columns = [
      { header: 'Indicador', key: 'indicator', width: 30 },
      { header: 'Valor', key: 'value', width: 30 },
    ];

    summarySheet.addRows([
      { indicator: 'Total de Produtos', value: report.kpis.total_products },
      { indicator: 'Total de Setores', value: report.kpis.total_sectors },
      { indicator: 'Valor Total do Inventário', value: formatCurrency(report.kpis.total_inventory_value) },
      { indicator: 'Itens com Baixo Estoque', value: report.kpis.low_stock_items },
      { indicator: 'Itens sem Estoque', value: report.kpis.out_of_stock_items },
    ]);

    // Products sheet
    const productsSheet = workbook.addWorksheet('Produtos');
    productsSheet.columns = [
      { header: 'Produto', key: 'product_name', width: 30 },
      { header: 'Setor', key: 'sector_name', width: 20 },
      { header: 'Categoria', key: 'category', width: 15 },
      { header: 'Estoque', key: 'current_stock', width: 12 },
      { header: 'Preço Unit.', key: 'unit_price', width: 15 },
      { header: 'Valor Total', key: 'total_value', width: 15 },
      { header: 'Status', key: 'stock_status', width: 12 },
    ];

    productsSheet.addRows(report.allProducts.map(p => ({
      product_name: p.product_name,
      sector_name: p.sector_name,
      category: p.category || 'N/A',
      current_stock: p.current_stock,
      unit_price: formatCurrency(p.unit_price),
      total_value: formatCurrency(p.total_value),
      stock_status: p.stock_status,
    })));

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inventario_Geral_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToPDF = () => {
    if (!report) return;

    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text('Relatório Geral de Inventário', 14, 20);

    doc.setFontSize(12);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    doc.setFontSize(14);
    doc.text('KPIs', 14, 40);

    autoTable(doc, {
      startY: 45,
      head: [['Indicador', 'Valor']],
      body: [
        ['Total de Produtos', report.kpis.total_products.toString()],
        ['Total de Setores', report.kpis.total_sectors.toString()],
        ['Valor Total', formatCurrency(report.kpis.total_inventory_value)],
        ['Itens Baixo Estoque', report.kpis.low_stock_items.toString()],
        ['Itens sem Estoque', report.kpis.out_of_stock_items.toString()],
      ],
    });

    const finalY = (doc as any).lastAutoTable.finalY || 80;

    doc.text('Produtos', 14, finalY + 10);

    autoTable(doc, {
      startY: finalY + 15,
      head: [['Produto', 'Setor', 'Estoque', 'Preço', 'Valor Total', 'Status']],
      body: report.allProducts.map(p => [
        p.product_name,
        p.sector_name,
        p.current_stock.toString(),
        formatCurrency(p.unit_price),
        formatCurrency(p.total_value),
        p.stock_status,
      ]),
    });

    doc.save(`Inventario_Geral_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">
            Relatório Geral de Inventário
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Setor</label>
              <Select value={selectedSector} onValueChange={setSelectedSector} data-testid="select-sector">
                <SelectTrigger>
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {sectors.map((sector: any) => (
                    <SelectItem key={sector.id} value={sector.id.toString()}>
                      {sector.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1 block">Palavra-chave</label>
              <Input
                type="text"
                placeholder="Buscar produto ou categoria..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                data-testid="input-keyword"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={includeOutOfStock}
                  onCheckedChange={(checked) => setIncludeOutOfStock(checked === true)}
                  data-testid="checkbox-include-out-of-stock"
                />
                <span className="text-sm font-medium">Incluir sem estoque</span>
              </label>
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
                  <CardTitle className="text-sm font-medium">Total de Setores</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-total-sectors">{report.kpis.total_sectors}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-total-value">{formatCurrency(report.kpis.total_inventory_value)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Baixo Estoque</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-low-stock">{report.kpis.low_stock_items}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Sem Estoque</CardTitle>
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-out-of-stock">{report.kpis.out_of_stock_items}</div>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-3">
              <Button onClick={exportToExcel} variant="outline" data-testid="button-export-excel">
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
              <Button onClick={exportToPDF} variant="outline" data-testid="button-export-pdf">
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle data-testid="text-pie-chart-title">Distribuição de Valor por Setor</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle data-testid="text-bar-chart-title">Valor Total por Setor</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barChartData} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                      <YAxis dataKey="name" type="category" />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="valor" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle data-testid="text-table-title">Todos os Produtos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-product">Produto</TableHead>
                        <TableHead data-testid="header-sector">Setor</TableHead>
                        <TableHead data-testid="header-category">Categoria</TableHead>
                        <TableHead className="text-right" data-testid="header-stock">Estoque</TableHead>
                        <TableHead className="text-right" data-testid="header-unit-price">Preço Unit.</TableHead>
                        <TableHead className="text-right" data-testid="header-total-value">Valor Total</TableHead>
                        <TableHead className="text-center" data-testid="header-status">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.allProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            Nenhum produto encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        report.allProducts.map((product) => (
                          <TableRow key={product.product_id} data-testid={`row-product-${product.product_id}`}>
                            <TableCell className="font-medium" data-testid={`text-product-name-${product.product_id}`}>
                              {product.product_name}
                            </TableCell>
                            <TableCell data-testid={`text-sector-${product.product_id}`}>
                              {product.sector_name}
                            </TableCell>
                            <TableCell data-testid={`text-category-${product.product_id}`}>
                              {product.category || 'N/A'}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-stock-${product.product_id}`}>
                              {product.current_stock}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-unit-price-${product.product_id}`}>
                              {formatCurrency(product.unit_price)}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-total-value-${product.product_id}`}>
                              {formatCurrency(product.total_value)}
                            </TableCell>
                            <TableCell className="text-center" data-testid={`cell-status-${product.product_id}`}>
                              {getStatusBadge(product.stock_status)}
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
