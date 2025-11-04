import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Package, Edit, Trash2, Grid, List, Upload } from 'lucide-react';
import type { ProductWithSector, Sector } from '@shared/schema';
import { ProductForm } from '@/components/product-form';
import { BulkImportDialog } from '@/components/bulk-import-dialog';

export default function Products() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithSector | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductWithSector | null>(null);
  const { toast } = useToast();

  const { data: products, isLoading } = useQuery<ProductWithSector[]>({
    queryKey: ['/api/products'],
  });

  const { data: sectors } = useQuery<Sector[]>({
    queryKey: ['/api/sectors'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: 'Produto excluído',
        description: 'O produto foi excluído com sucesso.',
      });
      setDeletingProduct(null);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Falha na exclusão',
        description: error.message || 'Falha ao excluir produto',
      });
    },
  });

  const filteredProducts = products?.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSector = sectorFilter === 'all' || product.sector_id?.toString() === sectorFilter;
    return matchesSearch && matchesSector;
  });

  const getStockBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive">Sem Estoque</Badge>;
    } else if (quantity < 10) {
      return <Badge className="bg-orange-500 hover:bg-orange-600">Estoque Baixo</Badge>;
    }
    return <Badge className="bg-green-600 hover:bg-green-700">Em Estoque</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Produtos</h1>
          <p className="text-muted-foreground mt-1">Gerencie seu inventário de produtos</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsBulkImportOpen(true)} 
            data-testid="button-bulk-import"
          >
            <Upload className="w-4 h-4 mr-2" />
            Importação em Lote
          </Button>
          <Button onClick={() => { setEditingProduct(null); setIsFormOpen(true); }} data-testid="button-add-product">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Produto
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos por nome ou SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-sector-filter">
                <SelectValue placeholder="Todos os Setores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Setores</SelectItem>
                {sectors?.map((sector) => (
                  <SelectItem key={sector.id} value={sector.id.toString()}>
                    {sector.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
                data-testid="button-view-grid"
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
                data-testid="button-view-list"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : !filteredProducts || filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum produto encontrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery || sectorFilter !== 'all' ? 'Tente ajustar seus filtros' : 'Comece adicionando seu primeiro produto'}
            </p>
            {!searchQuery && sectorFilter === 'all' && (
              <Button onClick={() => { setEditingProduct(null); setIsFormOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Produto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden hover-elevate" data-testid={`card-product-${product.id}`}>
              <div className="aspect-square bg-muted relative overflow-hidden">
                {product.photo_path ? (
                  <img
                    src={product.photo_path}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-16 h-16 text-muted-foreground opacity-20" />
                  </div>
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-lg truncate">{product.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {product.sku && (
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                        {product.sku}
                      </span>
                    )}
                    {product.sector_name && (
                      <Badge variant="outline" className="text-xs">
                        {product.sector_name}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">R${product.unit_price.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">
                      Estoque: {product.stock_quantity}
                    </div>
                  </div>
                  {getStockBadge(product.stock_quantity)}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => { setEditingProduct(product); setIsFormOpen(true); }}
                    data-testid={`button-edit-${product.id}`}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => setDeletingProduct(product)}
                    data-testid={`button-delete-${product.id}`}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="hover-elevate" data-testid={`row-product-${product.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-muted rounded-md flex-shrink-0 overflow-hidden">
                    {product.photo_path ? (
                      <img src={product.photo_path} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground opacity-20" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{product.name}</h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {product.sku && (
                        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {product.sku}
                        </span>
                      )}
                      {product.sector_name && (
                        <Badge variant="outline" className="text-xs">{product.sector_name}</Badge>
                      )}
                      {getStockBadge(product.stock_quantity)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-bold">R${product.unit_price.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">Estoque: {product.stock_quantity}</div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => { setEditingProduct(product); setIsFormOpen(true); }}
                      data-testid={`button-edit-${product.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => setDeletingProduct(product)}
                      data-testid={`button-delete-${product.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Atualizar informações do produto' : 'Criar um novo produto em seu inventário'}
            </DialogDescription>
          </DialogHeader>
          <ProductForm
            product={editingProduct}
            onSuccess={() => setIsFormOpen(false)}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Produto</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja excluir "{deletingProduct?.name}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProduct(null)} data-testid="button-cancel-delete">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingProduct && deleteMutation.mutate(deletingProduct.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkImportDialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen} />
    </div>
  );
}
