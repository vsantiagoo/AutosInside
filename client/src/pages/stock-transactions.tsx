import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  insertStockTransactionSchema, 
  type StockTransactionWithProduct, 
  type Product,
  type Sector,
  type User
} from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  History, 
  Loader2, 
  Package, 
  Filter,
  X,
  FileText,
  User as UserIcon,
  Building2,
  ArrowRightLeft,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { z } from 'zod';

const stockFormSchema = insertStockTransactionSchema.extend({
  transaction_type: z.string().optional(),
  document_origin: z.string().optional(),
  notes: z.string().optional(),
});

type StockFormData = z.infer<typeof stockFormSchema>;

const transactionTypes = [
  { value: 'Compra', label: 'Compra', variant: 'default' },
  { value: 'Venda', label: 'Venda', variant: 'destructive' },
  { value: 'Ajuste', label: 'Ajuste', variant: 'secondary' },
  { value: 'Transferência', label: 'Transferência', variant: 'outline' },
  { value: 'Perda/Dano', label: 'Perda/Dano', variant: 'destructive' },
  { value: 'Devolução', label: 'Devolução', variant: 'default' },
] as const;

const ITEMS_PER_PAGE = 20;

export default function StockTransactions() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Filters state
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Build query params from filters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedSector && selectedSector !== 'all') params.append('sector_id', selectedSector);
    if (selectedProduct && selectedProduct !== 'all') params.append('product_id', selectedProduct);
    if (selectedType && selectedType !== 'all') params.append('transaction_type', selectedType);
    if (selectedUser && selectedUser !== 'all') params.append('user_id', selectedUser);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    return params.toString();
  }, [selectedSector, selectedProduct, selectedType, selectedUser, startDate, endDate]);

  // Queries
  const { data: transactions, isLoading } = useQuery<StockTransactionWithProduct[]>({
    queryKey: ['/api/stock-movements', queryParams],
    queryFn: async () => {
      const url = queryParams ? `/api/stock-movements?${queryParams}` : '/api/stock-movements';
      const response = await fetch(url, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Falha ao buscar movimentações');
      }
      return response.json();
    },
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const { data: sectors } = useQuery<Sector[]>({
    queryKey: ['/api/sectors'],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Filter products by selected sector
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!selectedSector || selectedSector === 'all') return products;
    return products.filter(p => p.sector_id === parseInt(selectedSector));
  }, [products, selectedSector]);

  // Pagination calculations
  const totalItems = transactions?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTransactions = transactions?.slice(startIndex, endIndex) || [];

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [queryParams]);

  // Clamp current page when total pages changes (e.g., after deletion or filter)
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  const form = useForm<StockFormData>({
    resolver: zodResolver(stockFormSchema),
    defaultValues: {
      product_id: 0,
      change: 0,
      transaction_type: '',
      document_origin: '',
      notes: '',
    },
  });

  const selectedProductInForm = useMemo(() => {
    const productId = form.watch('product_id');
    return products?.find(p => p.id === productId);
  }, [form.watch('product_id'), products]);

  const createMutation = useMutation({
    mutationFn: async (data: StockFormData) => {
      return await apiRequest('POST', '/api/stock-movements', data);
    },
    onSuccess: () => {
      // Comprehensive cache invalidation for real-time integration
      queryClient.invalidateQueries({ queryKey: ['/api/stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/kpis'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stock-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sectors'] });
      // Invalidate sector-specific queries
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0]?.toString() || '';
        return key.includes('/api/sectors/') || key.includes('/api/reports/');
      }});
      
      toast({
        title: 'Estoque atualizado',
        description: 'A movimentação de estoque foi registrada com sucesso.',
      });
      setIsFormOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Falha na movimentação',
        description: error.message || 'Falha ao registrar movimentação de estoque',
      });
    },
  });

  const onSubmit = async (data: StockFormData) => {
    // Validate stock for exits
    if (data.change < 0 && selectedProductInForm) {
      const newStock = selectedProductInForm.stock_quantity + data.change;
      if (newStock < 0) {
        toast({
          variant: 'destructive',
          title: 'Estoque insuficiente',
          description: `Estoque atual: ${selectedProductInForm.stock_quantity}. Você está tentando retirar ${Math.abs(data.change)}.`,
        });
        return;
      }
    }

    await createMutation.mutateAsync(data);
  };

  const clearFilters = () => {
    setSelectedSector('all');
    setSelectedProduct('all');
    setSelectedType('all');
    setSelectedUser('all');
    setStartDate('');
    setEndDate('');
  };

  const hasActiveFilters = (selectedSector && selectedSector !== 'all') || 
                           (selectedProduct && selectedProduct !== 'all') || 
                           (selectedType && selectedType !== 'all') || 
                           (selectedUser && selectedUser !== 'all') || 
                           startDate || endDate;

  const getTypeVariant = (type: string | null): "default" | "destructive" | "secondary" | "outline" => {
    const typeConfig = transactionTypes.find(t => t.value === type);
    return (typeConfig?.variant as any) || 'secondary';
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Movimentações de Estoque</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Rastreie entradas, saídas e ajustes do inventário
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)} 
            className="w-full sm:w-auto"
            data-testid="button-toggle-filters"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="destructive" className="ml-2 px-1 min-w-5 h-5 rounded-full">
                {[selectedSector, selectedProduct, selectedType, selectedUser, startDate, endDate].filter(Boolean).length}
              </Badge>
            )}
          </Button>
          <Button 
            onClick={() => setIsFormOpen(true)} 
            className="w-full sm:w-auto"
            data-testid="button-add-transaction"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Movimentação
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card data-testid="filters-panel">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Filtros de Busca</CardTitle>
                <CardDescription>Refine a lista de movimentações</CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowFilters(false)}
                data-testid="button-close-filters"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Setor</label>
                <Select value={selectedSector} onValueChange={setSelectedSector}>
                  <SelectTrigger data-testid="filter-sector">
                    <SelectValue placeholder="Todos os setores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os setores</SelectItem>
                    {sectors?.map((sector) => (
                      <SelectItem key={sector.id} value={sector.id.toString()}>
                        {sector.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Produto</label>
                <Select 
                  value={selectedProduct} 
                  onValueChange={setSelectedProduct}
                  disabled={!!(selectedSector && filteredProducts.length === 0)}
                >
                  <SelectTrigger data-testid="filter-product">
                    <SelectValue placeholder="Todos os produtos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os produtos</SelectItem>
                    {(selectedSector ? filteredProducts : products)?.map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Transação</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger data-testid="filter-type">
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {transactionTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Usuário</label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger data-testid="filter-user">
                    <SelectValue placeholder="Todos os usuários" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os usuários</SelectItem>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Data Inicial</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="filter-start-date"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Data Final</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="filter-end-date"
                />
              </div>
            </div>

            {hasActiveFilters && (
              <div className="mt-4 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={clearFilters}
                  data-testid="button-clear-filters"
                >
                  <X className="w-4 h-4 mr-2" />
                  Limpar Filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !transactions || transactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <History className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">
              {hasActiveFilters ? 'Nenhuma movimentação encontrada' : 'Nenhuma movimentação registrada'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {hasActiveFilters 
                ? 'Tente ajustar os filtros de busca' 
                : 'Comece a rastrear as alterações do seu inventário'}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                <X className="w-4 h-4 mr-2" />
                Limpar Filtros
              </Button>
            ) : (
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Movimentação
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Data/Hora</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="max-w-[200px]">Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.map((transaction) => (
                    <TableRow key={transaction.id} data-testid={`transaction-row-${transaction.id}`}>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          {format(new Date(transaction.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-muted rounded flex-shrink-0 overflow-hidden">
                            {transaction.photo_path ? (
                              <img 
                                src={transaction.photo_path} 
                                alt={transaction.product_name} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-4 h-4 text-muted-foreground opacity-30" />
                              </div>
                            )}
                          </div>
                          <span className="font-medium">{transaction.product_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Building2 className="w-3 h-3" />
                          {transaction.sector_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {transaction.transaction_type ? (
                          <Badge variant={getTypeVariant(transaction.transaction_type)}>
                            {transaction.transaction_type}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {transaction.change > 0 ? (
                            <TrendingUp className="w-4 h-4 text-green-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-600" />
                          )}
                          <span className={`font-semibold ${transaction.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.change > 0 ? '+' : ''}{transaction.change}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <UserIcon className="w-3 h-3 text-muted-foreground" />
                          {transaction.user_name || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {transaction.document_origin ? (
                          <div className="flex items-center gap-1 text-xs font-mono">
                            <FileText className="w-3 h-3 text-muted-foreground" />
                            {transaction.document_origin}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {transaction.reason ? (
                          <p className="text-xs text-muted-foreground truncate" title={transaction.reason}>
                            {transaction.reason}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination Controls */}
      {transactions && transactions.length > 0 && totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                Mostrando <strong>{startIndex + 1}</strong> a <strong>{Math.min(endIndex, totalItems)}</strong> de{' '}
                <strong>{totalItems}</strong> movimentações
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  data-testid="button-previous-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first page, last page, current page, and pages around current
                      return (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      );
                    })
                    .map((page, index, array) => {
                      const showEllipsis = index > 0 && page - array[index - 1] > 1;
                      return (
                        <div key={page} className="flex items-center gap-1">
                          {showEllipsis && (
                            <span className="px-2 text-muted-foreground">...</span>
                          )}
                          <Button
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="min-w-8"
                            data-testid={`button-page-${page}`}
                          >
                            {page}
                          </Button>
                        </div>
                      );
                    })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Transaction Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Movimentação de Estoque</DialogTitle>
            <DialogDescription>
              Registrar entrada, saída ou ajuste de estoque para um produto
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="product_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Produto *</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString() || ''}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-product">
                            <SelectValue placeholder="Selecionar produto" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products?.map((product) => (
                            <SelectItem key={product.id} value={product.id.toString()}>
                              {product.name} (Estoque: {product.stock_quantity})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedProductInForm && (
                        <FormDescription>
                          Estoque atual: <strong>{selectedProductInForm.stock_quantity}</strong> unidades
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="transaction_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Transação</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue placeholder="Selecionar tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {transactionTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Opcional - classifique o tipo de movimentação
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="change"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Use negativo para diminuir estoque"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-change"
                      />
                    </FormControl>
                    <FormDescription>
                      Use números <strong>positivos</strong> para adicionar estoque (entrada) ou <strong>negativos</strong> para remover (saída)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="document_origin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Documento de Origem</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ex: NF-123456, OS-789"
                        {...field}
                        value={field.value || ''}
                        data-testid="input-document"
                      />
                    </FormControl>
                    <FormDescription>
                      Número da nota fiscal, ordem de serviço, etc.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas/Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Informações adicionais sobre esta movimentação"
                        className="resize-none"
                        rows={3}
                        {...field}
                        value={field.value || ''}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFormOpen(false)}
                  disabled={createMutation.isPending}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Registrar Movimentação
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
