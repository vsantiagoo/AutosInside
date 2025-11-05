import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertStockTransactionSchema, type StockTransactionWithProduct, type Product } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Plus, TrendingUp, TrendingDown, History, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { z } from 'zod';

const stockFormSchema = insertStockTransactionSchema.extend({
  reason: z.string().optional(),
});

type StockFormData = z.infer<typeof stockFormSchema>;

export default function StockTransactions() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  const { data: transactions, isLoading } = useQuery<StockTransactionWithProduct[]>({
    queryKey: ['/api/stock-transactions'],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const form = useForm<StockFormData>({
    resolver: zodResolver(stockFormSchema),
    defaultValues: {
      product_id: 0,
      change: 0,
      reason: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: StockFormData) => {
      return await apiRequest('POST', '/api/stock-transactions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stock-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
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
    await createMutation.mutateAsync(data);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Movimentações de Estoque</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Rastreie ajustes e alterações do inventário</p>
        </div>
        <Button 
          onClick={() => setIsFormOpen(true)} 
          className="w-full sm:w-auto"
          data-testid="button-add-transaction"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Movimentação
        </Button>
      </div>

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
            <h3 className="text-lg font-semibold mb-2">Nenhuma movimentação registrada</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece a rastrear as alterações do seu inventário
            </p>
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Movimentação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <Card key={transaction.id} className="hover-elevate" data-testid={`transaction-${transaction.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    transaction.change > 0 
                      ? 'bg-green-100 dark:bg-green-950' 
                      : 'bg-red-100 dark:bg-red-950'
                  }`}>
                    {transaction.change > 0 ? (
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{transaction.product_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {transaction.reason || 'Nenhum motivo especificado'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge 
                      variant={transaction.change > 0 ? 'default' : 'destructive'}
                      className="text-base font-semibold"
                    >
                      {transaction.change > 0 ? '+' : ''}{transaction.change}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(transaction.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Movimentação de Estoque</DialogTitle>
            <DialogDescription>
              Registrar um ajuste de estoque para um produto
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="change"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alteração *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Use negativo para diminuir"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        data-testid="input-change"
                      />
                    </FormControl>
                    <FormDescription>
                      Use números positivos para adicionar estoque, negativos para remover
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
                    <FormLabel>Motivo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Motivo opcional para o ajuste"
                        {...field}
                        value={field.value || ''}
                        data-testid="input-reason"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
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
