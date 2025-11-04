import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldCheck } from 'lucide-react';

const userLoginSchema = z.object({
  matricula: z.string()
    .min(1, "Matrícula é obrigatória")
    .trim(),
});

type UserLoginForm = z.infer<typeof userLoginSchema>;

export default function LoginUser() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<UserLoginForm>({
    resolver: zodResolver(userLoginSchema),
    defaultValues: {
      matricula: '',
    },
  });

  const onSubmit = async (data: UserLoginForm) => {
    setIsLoading(true);
    try {
      await login({ matricula: data.matricula, password: '' });
      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso.',
      });
      // Navigation will happen automatically when auth state updates
    } catch (error: any) {
      // Provide more specific error messages
      let errorMessage = 'Matrícula inválida';
      
      if (error.message?.includes('not found')) {
        errorMessage = 'Conta de usuário não encontrada. Verifique sua matrícula.';
      } else if (error.message?.includes('admin')) {
        errorMessage = 'Esta é uma conta de administrador. Use o Login de Administrador.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: 'destructive',
        title: 'Falha no login',
        description: errorMessage,
      });
      
      // Clear matricula field on error
      form.setValue('matricula', '');
      // Re-focus on input for better UX
      setTimeout(() => {
        document.querySelector<HTMLInputElement>('[data-testid="input-matricula"]')?.focus();
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center">
              <span className="material-icons text-white text-4xl">inventory_2</span>
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">Login de Usuário</CardTitle>
            <CardDescription className="text-base mt-2">
              Entre com sua matrícula
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="matricula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Matrícula</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Digite sua matrícula"
                        {...field}
                        data-testid="input-matricula"
                        autoFocus
                        autoComplete="username"
                        aria-label="Matrícula do usuário"
                        aria-required="true"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-login"
                aria-label="Entrar como usuário"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Entrar
              </Button>
            </form>
          </Form>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Administrador?
              </span>
            </div>
          </div>

          <Link to="/admin-login">
            <Button
              variant="outline"
              className="w-full"
              data-testid="link-admin-login"
              aria-label="Mudar para login de administrador"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              Login de Administrador
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
