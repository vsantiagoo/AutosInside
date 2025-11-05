import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { type ProductWithSector } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, LogOut, Loader2, UtensilsCrossed, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function FoodStation() {
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  const { logout } = useAuth();
  const { toast } = useToast();

  const { data: products, isLoading } = useQuery<ProductWithSector[]>({
    queryKey: ['/api/products'],
  });

  const endSessionMutation = useMutation({
    mutationFn: async () => {
      const consumptions = Object.entries(selectedItems)
        .filter(([_, qty]) => qty > 0)
        .map(([productId, qty]) => ({
          product_id: parseInt(productId),
          qty: qty,
        }));

      if (consumptions.length === 0) {
        throw new Error('Por favor, selecione pelo menos um item');
      }

      // Record each consumption
      for (const consumption of consumptions) {
        await apiRequest('POST', '/api/consumptions', consumption);
      }

      return consumptions;
    },
    onSuccess: (consumptions) => {
      toast({
        title: 'Sessão concluída',
        description: `${consumptions.length} item(ns) registrado(s). Saindo...`,
      });

      // Invalidate queries before logout
      queryClient.invalidateQueries({ queryKey: ['/api/consumptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

      // Logout after a short delay to show the toast
      setTimeout(async () => {
        await logout();
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Falha ao concluir sessão',
        description: error.message || 'Falha ao registrar consumo',
      });
    },
  });

  const toggleItem = (productId: number, checked: boolean) => {
    if (checked) {
      // When checking, set default quantity to 1
      setSelectedItems(prev => ({
        ...prev,
        [productId]: 1,
      }));
    } else {
      // When unchecking, remove the item
      setSelectedItems(prev => {
        const newItems = { ...prev };
        delete newItems[productId];
        return newItems;
      });
    }
  };

  const setQuantity = (productId: number, value: string) => {
    const qty = parseInt(value) || 1;
    if (qty > 0) {
      setSelectedItems(prev => ({
        ...prev,
        [productId]: qty,
      }));
    }
  };

  const handleEndSession = async () => {
    await endSessionMutation.mutateAsync();
  };

  const totalItems = Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0);
  const totalValue = products
    ? Object.entries(selectedItems).reduce((sum, [productId, qty]) => {
        const product = products.find(p => p.id === parseInt(productId));
        return sum + (product ? product.unit_price * qty : 0);
      }, 0)
    : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  const availableProducts = products?.filter(p => p.stock_quantity > 0 && p.sector_name === 'FoodStation') || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <UtensilsCrossed className="h-8 w-8 text-primary" />
              Estação de Alimentos
            </h1>
            <p className="text-muted-foreground mt-1">
              Selecione rapidamente os itens e encerre sua sessão
            </p>
          </div>
        </div>

        <Alert>
          <ShoppingCart className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                Selecionado: <strong>{totalItems}</strong> item(ns) • Total: <strong>R${totalValue.toFixed(2)}</strong>
              </span>
              <Button
                onClick={handleEndSession}
                disabled={totalItems === 0 || endSessionMutation.isPending}
                size="sm"
                data-testid="button-end-session"
              >
                {endSessionMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Encerrando Sessão...
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4 mr-2" />
                    Encerrar Sessão
                  </>
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>

      {availableProducts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Nenhum produto disponível em estoque
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {availableProducts.map((product) => {
                const quantity = selectedItems[product.id] || 0;
                const isSelected = quantity > 0;
                const itemTotal = product.unit_price * quantity;

                return (
                  <div 
                    key={product.id}
                    className={`p-4 flex items-center gap-4 hover-elevate ${isSelected ? 'bg-accent/30' : ''}`}
                    data-testid={`row-product-${product.id}`}
                  >
                    {/* Checkbox */}
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleItem(product.id, checked as boolean)}
                      data-testid={`checkbox-product-${product.id}`}
                      className="flex-shrink-0"
                    />

                    {/* Product Image */}
                    <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                      {product.photo_path ? (
                        <img
                          src={product.photo_path}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          data-testid={`img-product-${product.id}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-muted-foreground opacity-30" />
                        </div>
                      )}
                    </div>

                    {/* Product Name and Description */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">
                        {product.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Em estoque: {product.stock_quantity}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="text-right flex-shrink-0 w-24">
                      <p className="font-bold text-lg">
                        R${product.unit_price.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        unitário
                      </p>
                    </div>

                    {/* Quantity Input */}
                    <div className="flex-shrink-0 w-24">
                      <label className="text-xs text-muted-foreground block mb-1">
                        Quantidade
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max={product.stock_quantity}
                        value={isSelected ? quantity : ''}
                        onChange={(e) => setQuantity(product.id, e.target.value)}
                        disabled={!isSelected}
                        className="text-center h-9"
                        placeholder="0"
                        data-testid={`input-quantity-${product.id}`}
                      />
                    </div>

                    {/* Subtotal */}
                    <div className="text-right flex-shrink-0 w-28">
                      <p className="text-xs text-muted-foreground mb-1">
                        Subtotal
                      </p>
                      <p className={`font-bold text-lg ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                        R${isSelected ? itemTotal.toFixed(2) : '0.00'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
