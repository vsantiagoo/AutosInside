import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertSectorSchema, type Sector } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, FolderTree, Edit, Trash2, Loader2, Eye } from 'lucide-react';

export default function AdminSectors() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [deletingSector, setDeletingSector] = useState<Sector | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: sectors, isLoading } = useQuery<Sector[]>({
    queryKey: ['/api/sectors'],
    refetchInterval: 30000,
  });

  const form = useForm({
    resolver: zodResolver(insertSectorSchema),
    defaultValues: {
      name: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/sectors', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sectors'] });
      toast({
        title: 'Setor criado',
        description: 'O setor foi criado com sucesso.',
      });
      setIsFormOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Falha na criação',
        description: error.message || 'Falha ao criar setor',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return await apiRequest('PUT', `/api/sectors/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sectors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: 'Setor atualizado',
        description: 'O setor foi atualizado com sucesso.',
      });
      setIsFormOpen(false);
      setEditingSector(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Falha na atualização',
        description: error.message || 'Falha ao atualizar setor',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/sectors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sectors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: 'Setor excluído',
        description: 'O setor foi excluído com sucesso.',
      });
      setDeletingSector(null);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Falha na exclusão',
        description: error.message || 'Falha ao excluir setor',
      });
    },
  });

  const onSubmit = async (data: any) => {
    if (editingSector) {
      await updateMutation.mutateAsync({ id: editingSector.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleEdit = (sector: Sector) => {
    setEditingSector(sector);
    form.reset({ name: sector.name });
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    setEditingSector(null);
    form.reset({ name: '' });
    setIsFormOpen(true);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Setores</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Organize produtos por departamento ou categoria</p>
        </div>
        <Button onClick={handleAdd} className="w-full sm:w-auto" data-testid="button-add-sector">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Setor
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !sectors || sectors.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderTree className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Nenhum setor encontrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie setores para organizar seus produtos
            </p>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Setor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectors.map((sector) => (
            <Card key={sector.id} className="hover-elevate" data-testid={`sector-${sector.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FolderTree className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{sector.name}</h3>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="default"
                      size="icon"
                      onClick={() => navigate(`/sector/${sector.id}`)}
                      data-testid={`button-view-${sector.id}`}
                      title="Ver detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEdit(sector)}
                      data-testid={`button-edit-${sector.id}`}
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => setDeletingSector(sector)}
                      data-testid={`button-delete-${sector.id}`}
                      title="Excluir"
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSector ? 'Editar Setor' : 'Adicionar Novo Setor'}</DialogTitle>
            <DialogDescription>
              {editingSector ? 'Atualizar informações do setor' : 'Criar um novo setor para organizar produtos'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Setor *</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite o nome do setor" {...field} data-testid="input-name" />
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
                  disabled={isPending}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending} data-testid="button-submit">
                  {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingSector ? 'Atualizar Setor' : 'Criar Setor'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingSector} onOpenChange={(open) => !open && setDeletingSector(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Setor</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir "{deletingSector?.name}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingSector(null)} data-testid="button-cancel-delete">
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingSector && deleteMutation.mutate(deletingSector.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
