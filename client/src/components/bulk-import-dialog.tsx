import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/products/bulk-import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to import products');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: 'Import successful',
        description: data.message,
      });
      
      if (data.errors && data.errors.length > 0) {
        setImportErrors(data.errors);
      } else {
        setFile(null);
        onOpenChange(false);
      }
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: error.message,
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImportErrors([]);
    }
  };

  const handleImport = () => {
    if (file) {
      importMutation.mutate(file);
    }
  };

  const downloadTemplate = () => {
    const template = `Name,SKU,Unit Price,Stock Quantity,Sector,Low Stock Threshold
Laptop Computer,LAP-001,1200,50,Electronics,10
Office Chair,CHR-002,299.99,30,Furniture,5
Printer Paper,PPR-003,12.50,200,Office Supplies,20`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Products</DialogTitle>
          <DialogDescription>
            Import multiple products from an Excel or CSV file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Download Template</h4>
                    <p className="text-sm text-muted-foreground">
                      Use this template to format your product data
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={downloadTemplate}
                    data-testid="button-download-template"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Template
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">Template Format:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Name (required)</li>
                    <li>SKU (optional)</li>
                    <li>Unit Price (required)</li>
                    <li>Stock Quantity (required)</li>
                    <li>Sector (optional - must match existing sector name)</li>
                    <li>Low Stock Threshold (optional - defaults to 10)</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-3">Upload File</h4>
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    data-testid="input-import-file"
                  />
                  {file && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Selected: {file.name}
                    </p>
                  )}
                </div>

                {importErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <p className="font-medium mb-2">Import completed with errors:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {importErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setFile(null);
                setImportErrors([]);
                onOpenChange(false);
              }}
              disabled={importMutation.isPending}
              data-testid="button-cancel-import"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || importMutation.isPending}
              data-testid="button-submit-import"
            >
              {importMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Upload className="w-4 h-4 mr-2" />
              Import Products
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
