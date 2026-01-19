import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertConsumptionSchema, type ConsumptionWithDetails, type Product, type User } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, ShoppingCart, Loader2, Download } from 'lucide-react';
import { format } from 'date-fns';

export default function Consumptions() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();

  const { data: consumptions, isLoading } = useQuery<ConsumptionWithDetails[]>({
    queryKey: ['/api/consumptions'],
  });

  const { data: products } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  // Only need product_id and qty - user_id comes from authentication
  const consumptionFormSchema = insertConsumptionSchema.pick({ product_id: true, qty: true });

  const form = useForm({
    resolver: zodResolver(consumptionFormSchema),
    defaultValues: {
      product_id: 0,
      qty: 1,
    },
  });

  const selectedProductId = form.watch('product_id');
  const selectedProduct = products?.find(p => p.id === selectedProductId);
  const quantity = form.watch('qty');
  const totalPrice = selectedProduct ? selectedProduct.unit_price * quantity : 0;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/consumptions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Consumo registrado',
        description: 'O consumo foi registrado com sucesso.',
      });
      setIsFormOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Falha no registro',
        description: error.message || 'Falha ao registrar consumo',
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/consumptions/export', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Export failed');
      }
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consumptions-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast({
        title: 'Exportação bem-sucedida',
        description: 'Os consumos foram exportados para Excel.',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Falha na exportação',
        description: 'Falha ao exportar consumos',
      });
    },
  });

  const onSubmit = async (data: any) => {
    await createMutation.mutateAsync(data);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Consumos</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Rastreie uso e retiradas de produtos</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending || !consumptions?.length}
            className="flex-1 sm:flex-none"
            data-testid="button-export"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar para Excel
          </Button>
          <Button 
            onClick={() => setIsFormOpen(true)} 
            className="flex-1 sm:flex-none"
            data-testid="button-add-consumption"
          >
            <Plus className="w-4 h-4 mr-2" />
            Registrar Consumo
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !consumptions || consumptions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShoppingCart className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum consumo registrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece a rastrear o uso de produtos
            </p>
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Registrar Consumo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {consumptions.map((consumption) => (
            <Card key={consumption.id} className="hover-elevate" data-testid={`consumption-${consumption.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-muted rounded-md flex-shrink-0 overflow-hidden relative">
                    {consumption.photo_path ? (
                      <img 
                        src={consumption.photo_path} 
                        alt={consumption.product_name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-muted-foreground opacity-30" />
                      </div>
                    )}
                    <div className="absolute top-0 right-0 bg-primary rounded-bl-md p-0.5">
                      <ShoppingCart className="w-3 h-3 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{consumption.product_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {consumption.user_name} • Qtd: {consumption.qty}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-bold">R${consumption.total_price.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">
                      R${consumption.unit_price.toFixed(2)} por unidade
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(consumption.consumed_at), 'dd/MM/yyyy HH:mm')}
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
            <DialogTitle>Registrar Consumo</DialogTitle>
            <DialogDescription>
              Rastreie o uso do produto e atualize automaticamente o estoque
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
                            {product.name} - R${product.unit_price.toFixed(2)} (Estoque: {product.stock_quantity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProduct && selectedProduct.stock_quantity === 0 && (
                      <p className="text-sm text-destructive">Este produto está sem estoque</p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max={selectedProduct?.stock_quantity || 999999}
                        placeholder="Digite a quantidade"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        data-testid="input-quantity"
                      />
                    </FormControl>
                    {selectedProduct && (
                      <FormDescription>
                        Disponível: {selectedProduct.stock_quantity} unidades
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedProduct && quantity > 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Preço Total:</span>
                    <span className="text-2xl font-bold">R${totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              )}

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
                  Registrar Consumo
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
