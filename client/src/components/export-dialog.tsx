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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FoodStationConsumptionExportOptions, ExportFormat } from '@shared/schema';

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
  const [exportFormat, setExportFormat] = useState<ExportFormat>('consolidated');

  const handleExport = async () => {
    const options: FoodStationConsumptionExportOptions = {
      format: exportFormat,
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
            Escolha o formato de exportação desejado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Export Format Selection */}
          <div>
            <Label className="text-sm font-medium">Formato de Exportação</Label>
            <RadioGroup 
              value={exportFormat} 
              onValueChange={(value) => setExportFormat(value as ExportFormat)}
              className="mt-2 space-y-3"
              data-testid="radio-group-export-format"
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="consolidated" id="consolidated" data-testid="radio-consolidated" />
                <div className="flex-1">
                  <Label htmlFor="consolidated" className="cursor-pointer font-medium">
                    Consolidado
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uma linha por usuário com: Matrícula, Nome Completo, Valor Total Mensal e Período.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="detailed" id="detailed" data-testid="radio-detailed" />
                <div className="flex-1">
                  <Label htmlFor="detailed" className="cursor-pointer font-medium">
                    Detalhado
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Uma linha por consumo com: Matrícula, Nome, Item, Valor Unitário, Data de Consumo e outras informações.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

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
