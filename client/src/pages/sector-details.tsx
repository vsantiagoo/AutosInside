import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  ArrowLeft, 
  Plus, 
  Package, 
  TrendingDown, 
  TrendingUp, 
  DollarSign,
  Calendar,
  AlertTriangle,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { 
  Sector, 
  ProductDetailedInfo, 
  SectorPerformanceIndicators,
  StockTransactionWithProduct 
} from "@shared/schema";
import { format } from "date-fns";

export default function SectorDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const sectorId = parseInt(id || "0");

  // Fetch sector
  const { data: sector } = useQuery<Sector>({
    queryKey: [`/api/sectors/${sectorId}`],
    enabled: !!sectorId,
    refetchInterval: 30000,
  });

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery<ProductDetailedInfo[]>({
    queryKey: [`/api/sectors/${sectorId}/products`],
    enabled: !!sectorId,
    refetchInterval: 15000,
  });

  // Fetch performance indicators
  const { data: performance } = useQuery<SectorPerformanceIndicators>({
    queryKey: [`/api/sectors/${sectorId}/performance`],
    enabled: !!sectorId,
    refetchInterval: 20000,
  });

  // Fetch transactions
  const { data: transactions } = useQuery<StockTransactionWithProduct[]>({
    queryKey: [`/api/sectors/${sectorId}/transactions`],
    enabled: !!sectorId,
    refetchInterval: 20000,
  });

  const kpiCards = [
    {
      title: "Total de Produtos",
      value: performance?.total_products ?? 0,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Valor Total do Inventário",
      value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
        performance?.total_inventory_value ?? 0
      ),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Produtos com Estoque Baixo",
      value: performance?.low_stock_count ?? 0,
      icon: TrendingDown,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
    {
      title: "Produtos Zerados",
      value: performance?.out_of_stock_count ?? 0,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
    },
  ];

  const performanceMetrics = [
    {
      title: "Giro de Estoque",
      value: performance?.stock_turnover?.toFixed(2) ?? "N/A",
      description: "Renovação do estoque em 30 dias",
      icon: TrendingUp,
    },
    {
      title: "Cobertura de Estoque",
      value: performance?.coverage_days ? `${Math.round(performance.coverage_days)} dias` : "N/A",
      description: "Tempo de atendimento da demanda",
      icon: Calendar,
    },
    {
      title: "Frequência de Ruptura",
      value: performance?.stockout_frequency ?? 0,
      description: "Produtos que faltaram (30 dias)",
      icon: BarChart3,
    },
  ];

  const getStockStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      OK: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
      Baixo: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
      Zerado: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
      Excesso: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    };
    return (
      <Badge className={variants[status] || ""} data-testid={`badge-stock-${status.toLowerCase()}`}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6" data-testid="page-sector-details">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate(-1)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-sector-name">
              {sector?.name || "Setor"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Detalhes completos e indicadores de desempenho
            </p>
          </div>
        </div>
        <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-product">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Adicionar Novo Produto</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Formulário de cadastro será implementado aqui
            </p>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card, index) => (
          <Card key={index} data-testid={`card-kpi-${index}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <div className={`p-2 rounded-md ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`text-kpi-value-${index}`}>
                {card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Indicadores de Desempenho</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {performanceMetrics.map((metric, index) => (
              <div key={index} className="flex items-start gap-3" data-testid={`metric-${index}`}>
                <div className="p-2 rounded-md bg-muted">
                  <metric.icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-2xl font-bold">{metric.value}</div>
                  <div className="text-sm font-medium">{metric.title}</div>
                  <div className="text-xs text-muted-foreground">{metric.description}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Products and Transactions */}
      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products" data-testid="tab-products">
            Produtos ({products?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">
            Movimentações ({transactions?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Produtos do Setor</CardTitle>
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <p className="text-center py-4">Carregando produtos...</p>
              ) : !products || products.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  Nenhum produto cadastrado neste setor
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead className="text-right">Estoque</TableHead>
                        <TableHead className="text-right">Preço Custo</TableHead>
                        <TableHead className="text-right">Preço Venda</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Fornecedor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.sku || "-"}</TableCell>
                          <TableCell>{product.category || "-"}</TableCell>
                          <TableCell>{product.unit_measure || "un"}</TableCell>
                          <TableCell className="text-right">{product.stock_quantity}</TableCell>
                          <TableCell className="text-right">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.unit_price)}
                          </TableCell>
                          <TableCell className="text-right">
                            {product.sale_price 
                              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.sale_price)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(product.inventory_value)}
                          </TableCell>
                          <TableCell>{getStockStatusBadge(product.stock_status)}</TableCell>
                          <TableCell>{product.supplier || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Movimentações de Estoque</CardTitle>
            </CardHeader>
            <CardContent>
              {!transactions || transactions.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  Nenhuma movimentação registrada
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Responsável</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id} data-testid={`row-transaction-${transaction.id}`}>
                          <TableCell>
                            {format(new Date(transaction.created_at), "dd/MM/yyyy HH:mm")}
                          </TableCell>
                          <TableCell>{transaction.product_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{transaction.transaction_type || "Não especificado"}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {transaction.change > 0 ? `+${transaction.change}` : transaction.change}
                          </TableCell>
                          <TableCell>{transaction.reason || "-"}</TableCell>
                          <TableCell>{transaction.document_origin || "-"}</TableCell>
                          <TableCell>{transaction.user_name || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
