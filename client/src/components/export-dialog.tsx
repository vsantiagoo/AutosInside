import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FoodStationConsumptionExportOptions } from '@shared/schema';

interface ExportDialogProps {
  onExport: (options: FoodStationConsumptionExportOptions) => Promise<void>;
  isPending: boolean;
  userId?: number;
  userName?: string;
  startDate: string;
  endDate: string;
}

export default function ExportDialog({
  onExport,
  isPending,
  userId,
  userName,
  startDate,
  endDate,
}: ExportDialogProps) {
  const [open, setOpen] = useState(false);

  const handleExport = async () => {
    const options: FoodStationConsumptionExportOptions = {
      filters: {
        userId,
        startDate,
        endDate,
      },
    };

    await onExport(options);
    setOpen(false);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return 'N/A';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-export-excel">
          <Download className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            Exportar Relatório para Excel
          </DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            O arquivo Excel será gerado com uma linha por usuário contendo: Matrícula, Nome Completo, Valor Total Mensal e Período.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filter Summary */}
          <div>
            <p className="text-sm font-medium mb-2">Filtros Aplicados:</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" data-testid="badge-filter-period">
                <span className="text-xs">
                  {formatDate(startDate)} - {formatDate(endDate)}
                </span>
              </Badge>
              {userName && (
                <Badge variant="secondary" data-testid="badge-filter-user">
                  <span className="text-xs">{userName}</span>
                </Badge>
              )}
              {!userName && (
                <Badge variant="secondary" data-testid="badge-filter-all-users">
                  <span className="text-xs">Todos os Usuários</span>
                </Badge>
              )}
            </div>
          </div>

          {/* Export Format Info */}
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Formato de Exportação:</strong> Uma linha por usuário com matrícula, nome completo, valor total mensal e período do relatório.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
            data-testid="button-cancel-export"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={isPending}
            data-testid="button-confirm-export"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
