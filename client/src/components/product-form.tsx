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
import { useState } from 'react';
import { z } from 'zod';

const productFormSchema = insertProductSchema.extend({
  photo: z.instanceof(File).optional().or(z.literal('')),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  product?: ProductWithSector | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ProductForm({ product, onSuccess, onCancel }: ProductFormProps) {
  const { toast } = useToast();
  const [photoPreview, setPhotoPreview] = useState<string | null>(product?.photo_path || null);

  const { data: sectors } = useQuery<Sector[]>({
    queryKey: ['/api/sectors'],
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name || '',
      sector_id: product?.sector_id || undefined,
      sku: product?.sku || '',
      unit_price: product?.unit_price || 0,
      stock_quantity: product?.stock_quantity || 0,
      low_stock_threshold: product?.low_stock_threshold || 10,
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
        throw new Error(error.message || 'Failed to create product');
      }
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
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
    if (data.sector_id) formData.append('sector_id', data.sector_id.toString());
    if (data.sku && data.sku.trim() !== '') formData.append('sku', data.sku.trim());
    formData.append('unit_price', data.unit_price.toString());
    formData.append('stock_quantity', data.stock_quantity.toString());
    formData.append('low_stock_threshold', (data.low_stock_threshold || 10).toString());
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                  <Input placeholder="Código do produto" {...field} value={field.value || ''} data-testid="input-sku" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="unit_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço Unitário *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    data-testid="input-price"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stock_quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade em Estoque *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    data-testid="input-quantity"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="low_stock_threshold"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Limite de Estoque Baixo</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  placeholder="10"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
                  data-testid="input-threshold"
                />
              </FormControl>
              <FormDescription>
                Alerta quando o estoque cair abaixo deste nível
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="photo"
          render={({ field: { value, ...field } }) => (
            <FormItem>
              <FormLabel>Foto do Produto</FormLabel>
              <FormControl>
                <div className="space-y-3">
                  {photoPreview && (
                    <div className="relative inline-block">
                      <img
                        src={photoPreview}
                        alt="Pré-visualização"
                        className="w-32 h-32 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                        onClick={clearPhoto}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                      id="photo-upload"
                      data-testid="input-photo"
                      {...field}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('photo-upload')?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {photoPreview ? 'Alterar Foto' : 'Enviar Foto'}
                    </Button>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending} data-testid="button-cancel">
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
