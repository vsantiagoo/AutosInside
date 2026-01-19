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
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import logoImage from '@assets/WhatsApp_Image_2025-11-04_at_15.54.56_1768834777751.jpeg';

const adminLoginSchema = z.object({
  matricula: z.string()
    .min(1, "Matrícula é obrigatória")
    .trim(),
  password: z.string()
    .min(1, "Senha é obrigatória")
    .min(3, "Senha deve ter pelo menos 3 caracteres"),
});

type AdminLoginForm = z.infer<typeof adminLoginSchema>;

export default function AdminLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<AdminLoginForm>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      matricula: '',
      password: '',
    },
  });

  const onSubmit = async (data: AdminLoginForm) => {
    setIsLoading(true);
    try {
      await login(data);
      toast({
        title: 'Bem-vindo, Administrador!',
        description: 'Login realizado com sucesso.',
      });
      // Navigation will happen automatically when auth state updates
    } catch (error: any) {
      // Provide more specific error messages
      let errorMessage = 'Credenciais inválidas';
      
      if (error.message?.includes('not found')) {
        errorMessage = 'Conta de usuário não encontrada';
      } else if (error.message?.includes('password')) {
        errorMessage = 'Senha incorreta';
      } else if (error.message?.includes('admin')) {
        errorMessage = 'Esta conta não é de administrador';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: 'destructive',
        title: 'Falha no login',
        description: errorMessage,
      });
      
      // Clear password field on error for security
      form.setValue('password', '');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <img 
              src={logoImage} 
              alt="Logo" 
              className="w-24 h-24 object-contain animate-float mix-blend-multiply dark:mix-blend-screen dark:invert"
              data-testid="img-logo"
            />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">Login de Administrador</CardTitle>
            <CardDescription className="text-base mt-2">
              Entre com sua matrícula e senha
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
                        aria-label="Matrícula do administrador"
                        aria-required="true"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Digite sua senha"
                          {...field}
                          data-testid="input-password"
                          autoComplete="current-password"
                          aria-label="Senha do administrador"
                          aria-required="true"
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
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
                aria-label="Entrar como administrador"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Entrar como Admin
              </Button>
            </form>
          </Form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Não é administrador?
              </span>
            </div>
          </div>

          <Link to="/">
            <Button
              variant="outline"
              className="w-full"
              data-testid="link-user-login"
              aria-label="Mudar para login de usuário"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Login de Usuário
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
