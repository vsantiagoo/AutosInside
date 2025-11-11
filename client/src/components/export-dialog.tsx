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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FoodStationConsumptionExportOptions, ExportType, ExportField } from '@shared/schema';

interface ExportDialogProps {
  onExport: (options: FoodStationConsumptionExportOptions) => Promise<void>;
  isPending: boolean;
  userId?: number;
  userName?: string;
  startDate: string;
  endDate: string;
}

const FIELD_LABELS: Record<ExportField, string> = {
  matricula: 'Matrícula',
  nome: 'Nome Completo',
  produto: 'Produto',
  quantidade: 'Quantidade',
  precoUnitario: 'Preço Unitário',
  precoTotal: 'Preço Total',
  dataHora: 'Data e Hora',
};

const ALL_FIELDS: ExportField[] = [
  'matricula',
  'nome',
  'produto',
  'quantidade',
  'precoUnitario',
  'precoTotal',
  'dataHora',
];

export default function ExportDialog({
  onExport,
  isPending,
  userId,
  userName,
  startDate,
  endDate,
}: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ExportType>('complete');
  const [selectedFields, setSelectedFields] = useState<ExportField[]>(ALL_FIELDS);

  const handleTypeChange = (value: ExportType) => {
    setType(value);
    // Pre-select all fields when switching to custom
    if (value === 'custom') {
      setSelectedFields(ALL_FIELDS);
    }
  };

  const handleFieldToggle = (field: ExportField) => {
    setSelectedFields((prev) =>
      prev.includes(field)
        ? prev.filter((f) => f !== field)
        : [...prev, field]
    );
  };

  const handleExport = async () => {
    const options: FoodStationConsumptionExportOptions = {
      type,
      filters: {
        userId,
        startDate,
        endDate,
      },
      ...(type === 'custom' && { fields: selectedFields }),
    };

    await onExport(options);
    setOpen(false);
    // Reset to defaults
    setType('complete');
    setSelectedFields(ALL_FIELDS);
  };

  const isExportDisabled = type === 'custom' && selectedFields.length === 0;

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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            Exportar Relatório para Excel
          </DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            Configure as opções de exportação para o arquivo Excel
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

          {/* Report Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tipo de Relatório</Label>
            <RadioGroup value={type} onValueChange={handleTypeChange}>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="complete" id="type-complete" data-testid="radio-complete" />
                <div className="flex-1">
                  <Label
                    htmlFor="type-complete"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Completo
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Todas as colunas + planilha de totalizações mensais
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="custom" id="type-custom" data-testid="radio-custom" />
                <div className="flex-1">
                  <Label
                    htmlFor="type-custom"
                    className="text-sm font-medium cursor-pointer"
                  >
                    Resumido
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Selecione as colunas desejadas (sem totalizações mensais)
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Field Selection (Custom Mode) */}
          {type === 'custom' && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Colunas do Relatório</Label>
              {selectedFields.length === 0 && (
                <p className="text-xs text-destructive" data-testid="text-validation-error">
                  Selecione pelo menos uma coluna
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ALL_FIELDS.map((field) => (
                  <div key={field} className="flex items-center space-x-2">
                    <Checkbox
                      id={`field-${field}`}
                      checked={selectedFields.includes(field)}
                      onCheckedChange={() => handleFieldToggle(field)}
                      data-testid={`checkbox-${field}`}
                    />
                    <Label
                      htmlFor={`field-${field}`}
                      className="text-sm cursor-pointer"
                    >
                      {FIELD_LABELS[field]}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            disabled={isPending || isExportDisabled}
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
