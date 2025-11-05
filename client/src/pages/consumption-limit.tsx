import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { DollarSign, Shield } from "lucide-react";
import type { User, UpdateUserLimit } from "@shared/schema";

export default function ConsumptionLimit() {
  const { toast } = useToast();
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [monthlyLimit, setMonthlyLimit] = useState("");

  const { data: user } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const { data: monthlyData } = useQuery<{ total: number; year: number; month: number }>({
    queryKey: ['/api/consumptions/my-monthly-total'],
  });

  useEffect(() => {
    if (user) {
      setLimitEnabled(user.limit_enabled);
      setMonthlyLimit(user.monthly_limit?.toString() || "");
    }
  }, [user]);

  const updateLimitMutation = useMutation({
    mutationFn: async (data: UpdateUserLimit) => {
      return await apiRequest('PATCH', '/api/users/me/limit', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/consumptions/my-monthly-total'] });
      toast({
        title: "Limite atualizado!",
        description: "Suas configurações de limite de consumo foram salvas.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar limite",
        description: error.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const limit = monthlyLimit ? parseFloat(monthlyLimit) : null;
    
    if (limitEnabled && (limit === null || limit <= 0)) {
      toast({
        title: "Valor inválido",
        description: "Por favor, insira um valor válido para o limite mensal.",
        variant: "destructive",
      });
      return;
    }

    updateLimitMutation.mutate({
      limit_enabled: limitEnabled,
      monthly_limit: limit,
    });
  };

  const currentSpent = monthlyData?.total || 0;
  const limitValue = user?.monthly_limit || 0;
  const percentageUsed = limitValue > 0 ? (currentSpent / limitValue) * 100 : 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Limitação de Consumo</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Configure o limite mensal de gastos
        </p>
      </div>

      {user && monthlyData && user.limit_enabled && user.monthly_limit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Status do Limite Mensal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="text-xs sm:text-sm text-muted-foreground">Gasto no Mês</div>
                <div className="text-xl sm:text-2xl font-bold text-primary">
                  R$ {currentSpent.toFixed(2)}
                </div>
              </div>
              <div className="sm:text-right">
                <div className="text-xs sm:text-sm text-muted-foreground">Limite Mensal</div>
                <div className="text-xl sm:text-2xl font-bold">
                  R$ {limitValue.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Porcentagem Utilizada</span>
                <span className={percentageUsed >= 100 ? "text-destructive font-semibold" : ""}>
                  {percentageUsed.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all ${
                    percentageUsed >= 100 ? 'bg-destructive' : 
                    percentageUsed >= 80 ? 'bg-yellow-500' : 
                    'bg-primary'
                  }`}
                  style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                />
              </div>
            </div>

            {percentageUsed >= 100 && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive rounded-md">
                <Shield className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-destructive">Limite Ultrapassado</div>
                  <div className="text-sm text-muted-foreground">
                    Você já atingiu o limite mensal de consumo.
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configurar Limite</CardTitle>
          <CardDescription>
            Defina um valor máximo para seus gastos mensais na Estação de Alimentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 flex-1">
              <Label htmlFor="limit-enabled">Habilitar Limite de Consumo</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Ative para controlar seus gastos mensais
              </p>
            </div>
            <Switch
              id="limit-enabled"
              checked={limitEnabled}
              onCheckedChange={setLimitEnabled}
              data-testid="switch-limit-enabled"
              className="self-start sm:self-center"
            />
          </div>

          {limitEnabled && (
            <div className="space-y-2">
              <Label htmlFor="monthly-limit">Limite Mensal (R$)</Label>
              <Input
                id="monthly-limit"
                type="number"
                step="0.01"
                min="0"
                placeholder="Ex: 500.00"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                data-testid="input-monthly-limit"
              />
              <p className="text-sm text-muted-foreground">
                Insira o valor máximo que você deseja gastar por mês
              </p>
            </div>
          )}

          <Button 
            onClick={handleSave} 
            className="w-full"
            disabled={updateLimitMutation.isPending}
            data-testid="button-save-limit"
          >
            {updateLimitMutation.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como Funciona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • Ao habilitar o limite, você será avisado quando tentar fazer uma sessão que ultrapasse o valor configurado.
          </p>
          <p>
            • O limite é calculado mensalmente e reinicia no primeiro dia de cada mês.
          </p>
          <p>
            • Você pode ajustar o limite a qualquer momento nesta página.
          </p>
          <p>
            • Caso o limite seja ultrapassado, você terá a opção de aumentá-lo ou cancelar a sessão.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
