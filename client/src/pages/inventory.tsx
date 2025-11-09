import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, TrendingDown, TrendingUp, DollarSign, Download, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { InventoryKPIResponse } from "@shared/schema";

export default function Inventory() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: inventoryData, isLoading } = useQuery<InventoryKPIResponse>({
    queryKey: ['/api/inventory/kpis'],
    refetchInterval: 30000,
  });

  const handleDownloadReport = async (sectorId: number, sectorName: string) => {
    try {
      const response = await fetch(`/api/sectors/${sectorId}/export`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Erro ao baixar relatório');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Relatorio_${sectorName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Relatório baixado!",
        description: `O relatório do setor ${sectorName} foi baixado com sucesso.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao baixar relatório",
        description: "Não foi possível baixar o relatório. Tente novamente.",
      });
    }
  };

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
      <Card data-testid="card-total-inventory-value">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Valor Total do Inventário
          </CardTitle>
          <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950">
            <DollarSign className="w-5 h-5 text-purple-600" />
          </div>
        </CardHeader>
        <CardContent className="min-h-[60px] flex items-center">
          <div className="text-3xl font-bold leading-none" style={{ whiteSpace: 'nowrap' }} data-testid="text-total-value">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
          </div>
        </CardContent>
      </Card>

      {/* KPIs por Setor */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {kpis.map((sector: any) => (
          <Card key={sector.sector_id} className="hover-elevate" data-testid={`card-sector-${sector.sector_id}`}>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg font-bold mb-1" data-testid={`text-sector-name-${sector.sector_id}`}>{sector.sector_name}</CardTitle>
                  <CardDescription className="text-sm">Setor</CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  size="sm" 
                  variant="default"
                  className="flex-1 sm:flex-none"
                  onClick={() => navigate(`/sector/${sector.sector_id}`)}
                  data-testid={`button-view-details-${sector.sector_id}`}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver Detalhes
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleDownloadReport(sector.sector_id, sector.sector_name)}
                  data-testid={`button-download-report-${sector.sector_id}`}
                >
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Total de Produtos */}
              <div className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">Total de Produtos</span>
                </div>
                <span className="text-base font-bold flex-shrink-0" data-testid={`text-total-products-${sector.sector_id}`}>{sector.total_products}</span>
              </div>

              {/* Valor Total */}
              <div className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <DollarSign className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-medium truncate">Valor Total</span>
                </div>
                <span className="text-base font-bold flex-shrink-0 text-right whitespace-nowrap" data-testid={`text-sector-value-${sector.sector_id}`}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sector.total_value || 0)}
                </span>
              </div>

              {/* Estoque Baixo */}
              {sector.low_stock_count > 0 && (
                <div className="flex items-center justify-between gap-3 py-2 text-orange-600 dark:text-orange-400">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <TrendingDown className="w-4 h-4 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">Estoque Baixo</span>
                  </div>
                  <span className="text-base font-bold flex-shrink-0" data-testid={`text-low-stock-${sector.sector_id}`}>{sector.low_stock_count}</span>
                </div>
              )}

              {/* Sem Estoque */}
              {sector.out_of_stock_count > 0 && (
                <div className="flex items-center justify-between gap-3 py-2 text-destructive">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <TrendingUp className="w-4 h-4 rotate-180 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">Sem Estoque</span>
                  </div>
                  <span className="text-base font-bold flex-shrink-0" data-testid={`text-out-stock-${sector.sector_id}`}>{sector.out_of_stock_count}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
