import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { insertProductSchema, type InsertProduct, type ProductWithSector, type Sector } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { z } from 'zod';

const productFormSchema = insertProductSchema.extend({
  photo: z.any().optional(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  product?: ProductWithSector | null;
  onSuccess: () => void;
  onCancel: () => void;
  defaultSectorId?: number;
  showSectorSelector?: boolean;
  additionalQueryKeys?: string[][];
}

export function ProductForm({ 
  product, 
  onSuccess, 
  onCancel, 
  defaultSectorId,
  showSectorSelector = true,
  additionalQueryKeys = []
}: ProductFormProps) {
  const { toast } = useToast();
  const [photoPreview, setPhotoPreview] = useState<string | null>(product?.photo_path || null);

  const { data: sectors } = useQuery<Sector[]>({
    queryKey: ['/api/sectors'],
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? '',
      sector_id: product?.sector_id ?? defaultSectorId ?? undefined,
      sku: product?.sku ?? '',
      category: product?.category ?? '',
      unit_measure: product?.unit_measure ?? 'un',
      unit_price: product?.unit_price ?? 0,
      sale_price: product?.sale_price ?? null,
      stock_quantity: product?.stock_quantity ?? 0,
      min_quantity: product?.min_quantity ?? null,
      max_quantity: product?.max_quantity ?? null,
      low_stock_threshold: product?.low_stock_threshold ?? 10,
      supplier: product?.supplier ?? '',
      last_purchase_date: product?.last_purchase_date ?? null,
      last_count_date: product?.last_count_date ?? null,
      expiry_date: product?.expiry_date ?? null,
      warranty_date: product?.warranty_date ?? null,
      asset_number: product?.asset_number ?? '',
      status: product?.status ?? ('Ativo' as const),
      visible_to_users: product?.visible_to_users ?? true,
      photo: '',
    },
  });

  useEffect(() => {
    form.reset({
      name: product?.name ?? '',
      sector_id: product?.sector_id ?? defaultSectorId ?? undefined,
      sku: product?.sku ?? '',
      category: product?.category ?? '',
      unit_measure: product?.unit_measure ?? 'un',
      unit_price: product?.unit_price ?? 0,
      sale_price: product?.sale_price ?? null,
      stock_quantity: product?.stock_quantity ?? 0,
      min_quantity: product?.min_quantity ?? null,
      max_quantity: product?.max_quantity ?? null,
      low_stock_threshold: product?.low_stock_threshold ?? 10,
      supplier: product?.supplier ?? '',
      last_purchase_date: product?.last_purchase_date ?? null,
      last_count_date: product?.last_count_date ?? null,
      expiry_date: product?.expiry_date ?? null,
      warranty_date: product?.warranty_date ?? null,
      asset_number: product?.asset_number ?? '',
      status: product?.status ?? ('Ativo' as const),
      visible_to_users: product?.visible_to_users ?? true,
      photo: '',
    });
    setPhotoPreview(product?.photo_path || null);
  }, [product, defaultSectorId, form]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const result = await fetch('/api/products', {
        method: 'POST',
        body: data,
        credentials: 'include',
      });
      if (!result.ok) {
        const error = await result.json();
        throw new Error(error.message || 'Failed to create product');
      }
      return result.json();
    },
    onSuccess: () => {
      // Invalidar todas as queries relacionadas a produtos
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/kpis'] });
      
      // Invalidar TODAS as queries de setores (usa predicate para pegar todos os setores)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/sectors/');
        }
      });
      
      // Invalidar queries adicionais específicas
      additionalQueryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      
      toast({
        title: 'Produto criado',
        description: 'O produto foi criado com sucesso.',
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Falha na criação',
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const result = await fetch(`/api/products/${product!.id}`, {
        method: 'PUT',
        body: data,
        credentials: 'include',
      });
      if (!result.ok) {
        const error = await result.json();
        throw new Error(error.message || 'Failed to update product');
      }
      return result.json();
    },
    onSuccess: () => {
      // Invalidar todas as queries relacionadas a produtos
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/kpis'] });
      
      // Invalidar TODAS as queries de setores (usa predicate para pegar todos os setores)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/sectors/');
        }
      });
      
      // Invalidar queries adicionais específicas
      additionalQueryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      
      toast({
        title: 'Produto atualizado',
        description: 'O produto foi atualizado com sucesso.',
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Falha na atualização',
        description: error.message,
      });
    },
  });

  const onSubmit = async (data: ProductFormData) => {
    const formData = new FormData();
    formData.append('name', data.name);
    if (data.sector_id !== null && data.sector_id !== undefined) 
      formData.append('sector_id', data.sector_id.toString());
    if (data.sku && data.sku.trim() !== '') formData.append('sku', data.sku.trim());
    if (data.category) formData.append('category', data.category);
    if (data.unit_measure) formData.append('unit_measure', data.unit_measure);
    formData.append('unit_price', data.unit_price.toString());
    if (data.sale_price !== null && data.sale_price !== undefined) 
      formData.append('sale_price', data.sale_price.toString());
    formData.append('stock_quantity', data.stock_quantity.toString());
    if (data.min_quantity !== null && data.min_quantity !== undefined) 
      formData.append('min_quantity', data.min_quantity.toString());
    if (data.max_quantity !== null && data.max_quantity !== undefined) 
      formData.append('max_quantity', data.max_quantity.toString());
    formData.append('low_stock_threshold', (data.low_stock_threshold ?? 10).toString());
    if (data.supplier) formData.append('supplier', data.supplier);
    if (data.last_purchase_date) formData.append('last_purchase_date', data.last_purchase_date);
    if (data.last_count_date) formData.append('last_count_date', data.last_count_date);
    if (data.expiry_date) formData.append('expiry_date', data.expiry_date);
    if (data.warranty_date) formData.append('warranty_date', data.warranty_date);
    if (data.asset_number) formData.append('asset_number', data.asset_number);
    if (data.status) formData.append('status', data.status);
    formData.append('visible_to_users', data.visible_to_users?.toString() ?? 'true');
    if (data.photo instanceof File) {
      formData.append('photo', data.photo);
    }

    if (product) {
      await updateMutation.mutateAsync(formData);
    } else {
      await createMutation.mutateAsync(formData);
    }
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

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Informações Básicas */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground">Informações Básicas</h3>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Produto *</FormLabel>
                <FormControl>
                  <Input placeholder="Digite o nome do produto" {...field} data-testid="input-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="sku"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código SKU</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Código do produto" 
                      {...field} 
                      value={field.value || ''} 
                      data-testid="input-sku"
                      onChange={(e) => field.onChange(e.target.value.toUpperCase().trim())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showSectorSelector && (
              <FormField
                control={form.control}
                name="sector_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setor</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? null : parseInt(value))}
                      value={field.value?.toString() || "none"}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-sector">
                          <SelectValue placeholder="Selecione o setor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem Setor</SelectItem>
                        {sectors?.map((sector) => (
                          <SelectItem key={sector.id} value={sector.id.toString()}>
                            {sector.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                  <Select onValueChange={field.onChange} value={field.value || 'un'}>
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
                  <Select onValueChange={field.onChange} value={field.value || 'Ativo'}>
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

            <FormField
              control={form.control}
              name="visible_to_users"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={!field.value}
                      onChange={(e) => field.onChange(!e.target.checked)}
                      data-testid="checkbox-hide-from-foodstation"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Ocultar do FoodStation
                    </FormLabel>
                    <FormDescription>
                      Quando marcado, o produto não aparecerá no FoodStation para usuários, mas continuará sendo contabilizado nos relatórios
                    </FormDescription>
                  </div>
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
                      min="0"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      data-testid="input-unit-price"
                    />
                  </FormControl>
                  <FormDescription>Preço de compra do fornecedor</FormDescription>
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
                      min="0"
                      placeholder="0.00"
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      data-testid="input-sale-price"
                    />
                  </FormControl>
                  <FormDescription>Valor validado para cálculos de inventário</FormDescription>
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
                      min="0"
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
                      min="0"
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
                      min="0"
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
                      min="0"
                      placeholder="10"
                      {...field}
                      onChange={(e) => {
                        const val = e.target.value;
                        field.onChange(val === '' ? 10 : parseInt(val));
                      }}
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

        {/* Foto do Produto */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground">Foto do Produto</h3>
          <FormField
            control={form.control}
            name="photo"
            render={() => (
              <FormItem>
                <FormLabel>Imagem</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    {photoPreview && (
                      <div className="relative inline-block">
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="w-32 h-32 object-cover rounded-md"
                        />
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
                        className="flex-1"
                        id="photo-upload"
                        data-testid="input-photo"
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
            onClick={onCancel}
            disabled={isPending}
            data-testid="button-cancel"
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending} data-testid="button-submit">
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {product ? 'Atualizar Produto' : 'Criar Produto'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default ProductForm;
