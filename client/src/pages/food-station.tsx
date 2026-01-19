import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { type ProductWithSector, type User } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ShoppingCart, LogOut, Loader2, UtensilsCrossed, Package, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STORAGE_KEY = 'foodstation_selection';

export default function FoodStation() {
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const { logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: products, isLoading } = useQuery<ProductWithSector[]>({
    queryKey: ['/api/products'],
  });

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const { data: monthlyData } = useQuery<{ total: number; year: number; month: number }>({
    queryKey: ['/api/consumptions/my-monthly-total'],
  });

  // Load saved selection from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSelectedItems(parsed);
        localStorage.removeItem(STORAGE_KEY); // Clear after loading
      } catch (e) {
        console.error('Failed to parse saved selection', e);
      }
    }
  }, []);

  // Save selection to localStorage
  const saveSelection = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedItems));
  };

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
      queryClient.invalidateQueries({ queryKey: ['/api/consumptions/my-monthly-total'] });

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
    // Check if limit is enabled and would be exceeded
    if (user?.limit_enabled && user.monthly_limit && monthlyData) {
      const currentSpent = monthlyData.total;
      const newTotal = currentSpent + totalValue;
      
      if (newTotal > user.monthly_limit) {
        setShowLimitDialog(true);
        return;
      }
    }
    
    await endSessionMutation.mutateAsync();
  };

  const handleIncreaseLimit = () => {
    saveSelection();
    navigate('/consumption-limit');
  };

  const totalItems = Object.values(selectedItems).reduce((sum, qty) => sum + qty, 0);
  const totalValue = products
    ? Object.entries(selectedItems).reduce((sum, [productId, qty]) => {
        const product = products.find(p => p.id === parseInt(productId));
        const price = product ? (product.sale_price ?? product.unit_price) : 0;
        return sum + (price * qty);
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 md:gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            Estação de Alimentos
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Selecione rapidamente os itens e encerre sua sessão
          </p>
        </div>

        <Alert>
          <ShoppingCart className="h-4 w-4 flex-shrink-0" />
          <AlertDescription>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-sm md:text-base">
                Selecionado: <strong>{totalItems}</strong> item(ns) • Total: <strong>R${totalValue.toFixed(2)}</strong>
              </span>
              <Button
                onClick={handleEndSession}
                disabled={totalItems === 0 || endSessionMutation.isPending}
                size="sm"
                className="w-full sm:w-auto"
                data-testid="button-end-session"
              >
                {endSessionMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span className="hidden sm:inline">Encerrando Sessão...</span>
                    <span className="sm:hidden">Encerrando...</span>
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
                const price = product.sale_price ?? product.unit_price;
                const itemTotal = price * quantity;

                return (
                  <div 
                    key={product.id}
                    className={`p-3 md:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover-elevate ${isSelected ? 'bg-accent/30' : ''}`}
                    data-testid={`row-product-${product.id}`}
                  >
                    {/* Mobile: Top Row (Checkbox, Image, Name) */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Checkbox */}
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => toggleItem(product.id, checked as boolean)}
                        data-testid={`checkbox-product-${product.id}`}
                        className="flex-shrink-0"
                      />

                      {/* Product Image */}
                      <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted">
                        {product.photo_path ? (
                          <img
                            src={product.photo_path}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            data-testid={`img-product-${product.id}`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground opacity-30" />
                          </div>
                        )}
                      </div>

                      {/* Product Name and Description */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base truncate">
                          {product.name}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Em estoque: {product.stock_quantity}
                        </p>
                      </div>
                    </div>

                    {/* Mobile: Bottom Row / Desktop: Right Side (Price & Quantity & Subtotal) */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
                      {/* Price */}
                      <div className="text-left sm:text-right flex-shrink-0 order-1">
                        <p className="font-bold text-base sm:text-lg">
                          R${price.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          unitário
                        </p>
                      </div>

                      {/* Quantity Input */}
                      <div className="flex-shrink-0 w-28 order-2">
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
                      <div className="text-right flex-shrink-0 w-full sm:w-28 order-3">
                        <p className="text-xs text-muted-foreground mb-1">
                          Subtotal
                        </p>
                        <p className={`font-bold text-base sm:text-lg ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                          R${isSelected ? itemTotal.toFixed(2) : '0.00'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <AlertDialogContent data-testid="dialog-limit-exceeded">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Atenção! Você ultrapassou o seu limite de consumo.
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Você configurou um limite mensal de <strong>R$ {user?.monthly_limit?.toFixed(2)}</strong>.
              </p>
              <p>
                Com esta sessão, seu consumo total seria de <strong>R$ {((monthlyData?.total || 0) + totalValue).toFixed(2)}</strong>, 
                ultrapassando o limite estabelecido.
              </p>
              <p className="text-sm">
                Você pode aumentar o limite na página de configurações ou cancelar esta sessão.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-ok-limit">
              Ok
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleIncreaseLimit}
              data-testid="button-increase-limit"
            >
              Aumentar limite de consumo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
