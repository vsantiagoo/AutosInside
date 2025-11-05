import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, TrendingDown, TrendingUp, DollarSign } from "lucide-react";

export default function Inventory() {
  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['/api/inventory/kpis'],
  });

  if (isLoading) {
    return (
      <div className="space-y-4 md:space-y-6 p-4 md:p-6">
        <h1 className="text-2xl md:text-3xl font-bold">Inventário por Setor</h1>
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const kpis = inventoryData?.kpis || [];
  const totalValue = inventoryData?.totalValue || 0;

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Inventário por Setor</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Visão geral do inventário organizado por setores
        </p>
      </div>

      {/* Valor Total do Inventário */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Valor Total do Inventário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl md:text-4xl font-bold text-primary">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
          </div>
        </CardContent>
      </Card>

      {/* KPIs por Setor */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {kpis.map((sector: any) => (
          <Card key={sector.sector_id} className="hover-elevate">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">{sector.sector_name}</CardTitle>
              <CardDescription>Setor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Total de Produtos */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Total de Produtos</span>
                </div>
                <span className="font-semibold">{sector.total_products}</span>
              </div>

              {/* Valor Total */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Valor Total</span>
                </div>
                <span className="font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sector.total_value || 0)}
                </span>
              </div>

              {/* Estoque Baixo */}
              {sector.low_stock_count > 0 && (
                <div className="flex items-center justify-between text-orange-600 dark:text-orange-400">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-sm">Estoque Baixo</span>
                  </div>
                  <span className="font-semibold">{sector.low_stock_count}</span>
                </div>
              )}

              {/* Sem Estoque */}
              {sector.out_of_stock_count > 0 && (
                <div className="flex items-center justify-between text-destructive">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 rotate-180" />
                    <span className="text-sm">Sem Estoque</span>
                  </div>
                  <span className="font-semibold">{sector.out_of_stock_count}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
