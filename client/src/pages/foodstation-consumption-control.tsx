import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Users, DollarSign, ShoppingBag, FileText } from 'lucide-react';
import type { FoodStationConsumptionControlReport, User } from '@shared/schema';
import { cn } from '@/lib/utils';

export default function FoodStationConsumptionControlPage() {
  const { toast } = useToast();
  
  // Get current month range
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Filter states
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: monthStart,
    to: monthEnd,
  });
  const [appliedFilters, setAppliedFilters] = useState({
    userId: 'all',
    startDate: monthStart.toISOString(),
    endDate: monthEnd.toISOString(),
  });

  // Fetch users for dropdown
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  // Fetch consumption report
  const { data: report, isLoading, error, refetch } = useQuery<FoodStationConsumptionControlReport>({
    queryKey: ['/api/reports/foodstation/consumption-control', appliedFilters.userId, appliedFilters.startDate, appliedFilters.endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(appliedFilters.userId !== 'all' && { userId: appliedFilters.userId }),
        startDate: appliedFilters.startDate,
        endDate: appliedFilters.endDate,
      });
      const res = await fetch(`/api/reports/foodstation/consumption-control?${params}`);
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to fetch consumption report');
      }
      return res.json();
    },
    enabled: !!appliedFilters.startDate && !!appliedFilters.endDate,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (error) {
      toast({
        title: 'Erro ao carregar relatório',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const handleFilter = () => {
    setAppliedFilters({
      userId: selectedUserId,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
    });
    refetch();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const formatDateRange = (start: string, end: string) => {
    try {
      const startDate = format(new Date(start), "dd/MM/yyyy", { locale: ptBR });
      const endDate = format(new Date(end), "dd/MM/yyyy", { locale: ptBR });
      return `${startDate} - ${endDate}`;
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground" data-testid="text-page-title">
              Controle de Consumo - FoodStation
            </h1>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
              Relatório detalhado de consumos por usuário e período
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-1.5 block">Usuário</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger data-testid="select-user">
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-user-all">Todos os Usuários</SelectItem>
                  {users.map((user) => (
                    <SelectItem 
                      key={user.id} 
                      value={user.id.toString()}
                      data-testid={`option-user-${user.id}`}
                    >
                      {user.full_name} ({user.matricula})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[280px]">
              <label className="text-sm font-medium mb-1.5 block">Período</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                    data-testid="button-date-range"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                          {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                      )
                    ) : (
                      <span>Selecione o período</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                      }
                    }}
                    numberOfMonths={2}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button 
              onClick={handleFilter} 
              className="min-w-[120px]"
              data-testid="button-filter"
            >
              Filtrar
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        {/* KPI Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : report ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardDescription>Total de Itens</CardDescription>
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-total-items">
                    {report.totalItems}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Unidades consumidas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardDescription>Valor Total</CardDescription>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-monthly-total">
                    {formatCurrency(report.monthlyTotal)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Valor acumulado
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardDescription>Período</CardDescription>
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-base font-semibold" data-testid="text-kpi-period">
                    {formatDateRange(report.period.start, report.period.end)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Intervalo selecionado
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardDescription>Registros</CardDescription>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-kpi-record-count">
                    {report.records.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Consumos registrados
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Consumption Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detalhamento de Consumos</CardTitle>
                {report.userName && (
                  <CardDescription>
                    Usuário: {report.userName}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {report.records.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="text-no-records">
                    Nenhum consumo encontrado no período selecionado.
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <Table className="min-w-[900px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead data-testid="header-photo">Foto</TableHead>
                          <TableHead data-testid="header-matricula">Matrícula</TableHead>
                          <TableHead data-testid="header-user">Usuário</TableHead>
                          <TableHead data-testid="header-product">Produto</TableHead>
                          <TableHead className="text-right" data-testid="header-quantity">Qtd</TableHead>
                          <TableHead className="text-right" data-testid="header-unit-price">Preço Unit.</TableHead>
                          <TableHead className="text-right" data-testid="header-total-price">Total</TableHead>
                          <TableHead data-testid="header-consumed-at">Data/Hora</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.records.map((record) => (
                          <TableRow key={record.consumption_id} data-testid={`row-consumption-${record.consumption_id}`}>
                            <TableCell>
                              <Avatar className="h-8 w-8">
                                {record.photo_path && (
                                  <AvatarImage 
                                    src={record.photo_path} 
                                    alt={record.product_name}
                                    data-testid={`img-product-${record.consumption_id}`}
                                  />
                                )}
                                <AvatarFallback data-testid={`avatar-fallback-${record.consumption_id}`}>
                                  {record.product_name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </TableCell>
                            <TableCell data-testid={`text-matricula-${record.consumption_id}`}>
                              {record.matricula}
                            </TableCell>
                            <TableCell data-testid={`text-username-${record.consumption_id}`}>
                              {record.user_name}
                            </TableCell>
                            <TableCell data-testid={`text-product-${record.consumption_id}`}>
                              {record.product_name}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-quantity-${record.consumption_id}`}>
                              {record.quantity}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-unit-price-${record.consumption_id}`}>
                              {formatCurrency(record.unit_price)}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-total-price-${record.consumption_id}`}>
                              {formatCurrency(record.total_price)}
                            </TableCell>
                            <TableCell data-testid={`text-consumed-at-${record.consumption_id}`}>
                              {formatDateTime(record.consumed_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
