import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Calendar, DollarSign } from "lucide-react";
import type { ConsumptionWithDetails } from "@shared/schema";

export default function MyConsumptionReport() {
  const today = new Date();
  const currentMonth = format(today, "yyyy-MM");
  const firstDayOfMonth = `${currentMonth}-01`;
  const lastDayOfMonth = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), "yyyy-MM-dd");
  
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);
  const [month, setMonth] = useState(currentMonth);

  const { data: consumptions = [], isLoading } = useQuery<ConsumptionWithDetails[]>({
    queryKey: ['/api/consumptions/my', startDate, endDate],
    enabled: !!startDate || !!endDate,
  });

  const { data: monthlyData } = useQuery<{ total: number; year: number; month: number }>({
    queryKey: ['/api/consumptions/my-monthly-total'],
  });

  const handleMonthChange = (newMonth: string) => {
    setMonth(newMonth);
    const [year, monthNum] = newMonth.split('-');
    const firstDay = `${year}-${monthNum}-01`;
    const lastDay = new Date(parseInt(year), parseInt(monthNum), 0);
    const lastDayStr = `${year}-${monthNum}-${String(lastDay.getDate()).padStart(2, '0')}`;
    
    setStartDate(firstDay);
    setEndDate(lastDayStr);
  };

  const handleTodayFilter = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    setStartDate(today);
    setEndDate(today);
  };

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const groupByDate = (consumptions: ConsumptionWithDetails[]) => {
    const groups: { [key: string]: ConsumptionWithDetails[] } = {};
    consumptions.forEach(c => {
      const dateKey = c.consumed_at.split('T')[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(c);
    });
    return groups;
  };

  const calculateDayTotal = (consumptions: ConsumptionWithDetails[]) => {
    return consumptions.reduce((sum, c) => sum + c.total_price, 0);
  };

  const calculatePeriodTotal = (consumptions: ConsumptionWithDetails[]) => {
    return consumptions.reduce((sum, c) => sum + c.total_price, 0);
  };

  const groupedConsumptions = consumptions.length > 0 ? groupByDate(consumptions) : {};
  const periodTotal = calculatePeriodTotal(consumptions);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatório de Consumo</h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe seu consumo diário e mensal
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="month-select">Filtrar por Mês</Label>
              <Input
                id="month-select"
                type="month"
                value={month}
                onChange={(e) => handleMonthChange(e.target.value)}
                data-testid="input-month-filter"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-date">Data Início</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date">Data Fim</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={handleTodayFilter} 
              variant="outline"
              data-testid="button-today-filter"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Hoje
            </Button>
            <Button 
              onClick={handleClearFilter} 
              variant="outline"
              data-testid="button-clear-filter"
            >
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {monthlyData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Consumo do Mês Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              R$ {monthlyData.total.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(monthlyData.year, monthlyData.month - 1), "MMMM 'de' yyyy", { locale: { code: 'pt-BR' } as any })}
            </p>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Carregando consumos...
          </CardContent>
        </Card>
      )}

      {!isLoading && consumptions.length === 0 && (startDate || endDate) && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            Nenhum consumo encontrado no período selecionado
          </CardContent>
        </Card>
      )}

      {!isLoading && consumptions.length > 0 && (
        <div className="space-y-4">
          {Object.entries(groupedConsumptions).map(([date, items]) => {
            const dayTotal = calculateDayTotal(items);
            const dateObj = new Date(date + 'T00:00:00');
            
            return (
              <Card key={date} data-testid={`card-day-${date}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {dateObj.toLocaleDateString('pt-BR', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </CardTitle>
                    <div className="text-lg font-semibold text-primary">
                      Total: R$ {dayTotal.toFixed(2)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {items.map((consumption) => (
                      <div 
                        key={consumption.id} 
                        className="flex items-center justify-between p-3 border rounded-md"
                        data-testid={`consumption-item-${consumption.id}`}
                      >
                        <div className="flex-1">
                          <div className="font-medium">{consumption.product_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Horário: {formatDateTime(consumption.consumed_at)}
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-sm text-muted-foreground">
                            {consumption.qty} x R$ {consumption.unit_price.toFixed(2)}
                          </div>
                          <div className="font-semibold text-primary">
                            R$ {consumption.total_price.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {consumptions.length > 0 && Object.keys(groupedConsumptions).length > 1 && (
            <Card className="border-primary">
              <CardContent className="p-6">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total do Período</span>
                  <span className="text-2xl text-primary">
                    R$ {periodTotal.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
