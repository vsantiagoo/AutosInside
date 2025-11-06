import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, type InsertProduct } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { 
  ArrowLeft, 
  Plus, 
  Package, 
  TrendingDown, 
  TrendingUp, 
  DollarSign,
  Calendar,
  AlertTriangle,
  BarChart3,
  Loader2,
  Upload,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { useToast } from "@/hooks/use-toast";
import type { 
  Sector, 
  ProductDetailedInfo, 
  SectorPerformanceIndicators,
  StockTransactionWithProduct 
} from "@shared/schema";
import { format } from "date-fns";

const productFormSchema = insertProductSchema.extend({
  photo: z.instanceof(File).optional().or(z.literal('')),
});

type ProductFormData = z.infer<typeof productFormSchema>;

export default function SectorDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const { toast } = useToast();
  const sectorId = parseInt(id || "0");

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      sector_id: sectorId,
      sku: '',
      category: '',
      unit_measure: 'un',
      unit_price: 0,
      sale_price: null,
      stock_quantity: 0,
      min_quantity: null,
      max_quantity: null,
      low_stock_threshold: 10,
      supplier: '',
      last_purchase_date: null,
      last_count_date: null,
      expiry_date: null,
      warranty_date: null,
      asset_number: '',
      status: 'Ativo',
      photo: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const result = await fetch('/api/products', {
        method: 'POST',
        body: data,
        credentials: 'include',
      });
      if (!result.ok) {
        const error = await result.json();
        throw new Error(error.message || 'Erro ao criar produto');
      }
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sectors/${sectorId}/products`] });
      queryClient.invalidateQueries({ queryKey: [`/api/sectors/${sectorId}/performance`] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/kpis'] });
      toast({
        title: 'Produto criado',
        description: 'O produto foi criado com sucesso.',
      });
      setIsAddProductOpen(false);
      form.reset();
      setPhotoPreview(null);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Falha na criação',
        description: error.message,
      });
    },
  });

  const onSubmit = async (data: ProductFormData) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('sector_id', String(data.sector_id || sectorId));
    if (data.sku) formData.append('sku', data.sku);
    if (data.category) formData.append('category', data.category);
    if (data.unit_measure) formData.append('unit_measure', data.unit_measure);
    formData.append('unit_price', String(data.unit_price));
    if (data.sale_price) formData.append('sale_price', String(data.sale_price));
    formData.append('stock_quantity', String(data.stock_quantity));
    if (data.min_quantity !== null && data.min_quantity !== undefined) 
      formData.append('min_quantity', String(data.min_quantity));
    if (data.max_quantity !== null && data.max_quantity !== undefined) 
      formData.append('max_quantity', String(data.max_quantity));
    formData.append('low_stock_threshold', String(data.low_stock_threshold));
    if (data.supplier) formData.append('supplier', data.supplier);
    if (data.last_purchase_date) formData.append('last_purchase_date', data.last_purchase_date);
    if (data.last_count_date) formData.append('last_count_date', data.last_count_date);
    if (data.expiry_date) formData.append('expiry_date', data.expiry_date);
    if (data.warranty_date) formData.append('warranty_date', data.warranty_date);
    if (data.asset_number) formData.append('asset_number', data.asset_number);
    if (data.status) formData.append('status', data.status);
    if (data.photo && typeof data.photo !== 'string') {
      formData.append('photo', data.photo);
    }
    await createMutation.mutateAsync(formData);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue('photo', file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = () => {
    form.setValue('photo', '');
    setPhotoPreview(null);
  };

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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Informações Básicas */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">Informações Básicas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Nome do Produto *</FormLabel>
                          <FormControl>
                            <Input placeholder="Digite o nome do produto" {...field} data-testid="input-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU</FormLabel>
                          <FormControl>
                            <Input placeholder="Código SKU" {...field} value={field.value || ''} data-testid="input-sku" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoria</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Eletrônicos, Alimentação" {...field} value={field.value || ''} data-testid="input-category" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="unit_measure"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unidade de Medida</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || 'un'}>
                            <FormControl>
                              <SelectTrigger data-testid="select-unit-measure">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="un">Unidade (un)</SelectItem>
                              <SelectItem value="kg">Quilograma (kg)</SelectItem>
                              <SelectItem value="g">Grama (g)</SelectItem>
                              <SelectItem value="l">Litro (l)</SelectItem>
                              <SelectItem value="ml">Mililitro (ml)</SelectItem>
                              <SelectItem value="m">Metro (m)</SelectItem>
                              <SelectItem value="cm">Centímetro (cm)</SelectItem>
                              <SelectItem value="cx">Caixa (cx)</SelectItem>
                              <SelectItem value="pct">Pacote (pct)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || 'Ativo'}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Ativo">Ativo</SelectItem>
                              <SelectItem value="Inativo">Inativo</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Informações Financeiras */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">Informações Financeiras</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="unit_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço de Custo (R$) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00" 
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              data-testid="input-unit-price"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sale_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preço de Venda (R$)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.01" 
                              placeholder="0.00" 
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                              data-testid="input-sale-price"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Controle de Estoque */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">Controle de Estoque</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="stock_quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantidade Inicial *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-stock-quantity"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="min_quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantidade Mínima</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                              data-testid="input-min-quantity"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="max_quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantidade Máxima</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0" 
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                              data-testid="input-max-quantity"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="low_stock_threshold"
                      render={({ field }) => (
                        <FormItem className="md:col-span-3">
                          <FormLabel>Limiar de Estoque Baixo</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="10" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
                              data-testid="input-low-stock-threshold"
                            />
                          </FormControl>
                          <FormDescription>
                            Alertas serão gerados quando o estoque atingir este valor
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Fornecedor e Patrimônio */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">Fornecedor e Patrimônio</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="supplier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fornecedor</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do fornecedor" {...field} value={field.value || ''} data-testid="input-supplier" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="asset_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Patrimônio</FormLabel>
                          <FormControl>
                            <Input placeholder="Número do ativo" {...field} value={field.value || ''} data-testid="input-asset-number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Datas */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">Datas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="last_purchase_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data da Última Compra</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              value={field.value || ''} 
                              data-testid="input-last-purchase-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="expiry_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Validade</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              value={field.value || ''} 
                              data-testid="input-expiry-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="warranty_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Garantia</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              value={field.value || ''} 
                              data-testid="input-warranty-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="last_count_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data da Última Contagem</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              value={field.value || ''} 
                              data-testid="input-last-count-date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Foto */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">Foto do Produto</h3>
                  <FormField
                    control={form.control}
                    name="photo"
                    render={({ field: { onChange, value, ...field } }) => (
                      <FormItem>
                        <FormLabel>Imagem</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            {photoPreview && (
                              <div className="relative inline-block">
                                <img src={photoPreview} alt="Preview" className="w-32 h-32 object-cover rounded-md" />
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  className="absolute -top-2 -right-2 h-6 w-6"
                                  onClick={clearPhoto}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                {...field}
                                data-testid="input-photo"
                                className="flex-1"
                              />
                              <Upload className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Envie uma imagem do produto (opcional)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Botões */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddProductOpen(false)}
                    disabled={createMutation.isPending}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Criar Produto
                  </Button>
                </div>
              </form>
            </Form>
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
