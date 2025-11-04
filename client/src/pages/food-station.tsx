import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { type ProductWithSector } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, ShoppingCart, LogOut, Loader2, UtensilsCrossed, Package } from 'lucide-react';
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

  const incrementItem = (productId: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }));
  };

  const decrementItem = (productId: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] || 0) - 1),
    }));
  };

  const setQuantity = (productId: number, value: string) => {
    const qty = parseInt(value) || 0;
    setSelectedItems(prev => ({
      ...prev,
      [productId]: Math.max(0, qty),
    }));
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

  const availableProducts = products?.filter(p => p.stock_quantity > 0) || [];

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableProducts.map((product) => {
            const quantity = selectedItems[product.id] || 0;
            const itemTotal = product.unit_price * quantity;

            return (
              <Card 
                key={product.id} 
                className={quantity > 0 ? 'border-primary' : ''}
                data-testid={`card-product-${product.id}`}
              >
                <div className="overflow-hidden">
                  <AspectRatio ratio={16 / 9}>
                    {product.photo_path ? (
                      <img
                        src={product.photo_path}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        data-testid={`img-product-${product.id}`}
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Package className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </AspectRatio>
                </div>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {product.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {product.sector_name && (
                          <Badge variant="outline" className="text-xs">
                            {product.sector_name}
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                    {quantity > 0 && (
                      <Badge variant="default" data-testid={`badge-quantity-${product.id}`}>
                        {quantity}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Preço:</span>
                      <span className="font-semibold">R${product.unit_price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Em Estoque:</span>
                      <span className={product.stock_quantity < 10 ? 'text-destructive font-medium' : ''}>
                        {product.stock_quantity}
                      </span>
                    </div>
                    {quantity > 0 && (
                      <div className="flex items-center justify-between text-sm pt-2 border-t">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span className="font-bold text-primary">R${itemTotal.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => decrementItem(product.id)}
                    disabled={quantity === 0}
                    data-testid={`button-decrement-${product.id}`}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min="0"
                    max={product.stock_quantity}
                    value={quantity}
                    onChange={(e) => setQuantity(product.id, e.target.value)}
                    className="text-center"
                    data-testid={`input-quantity-${product.id}`}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => incrementItem(product.id)}
                    disabled={quantity >= product.stock_quantity}
                    data-testid={`button-increment-${product.id}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
