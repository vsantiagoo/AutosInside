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
  matricula: z.string().min(1, "Matricula is required"),
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
        title: 'Welcome back!',
        description: 'You have successfully logged in.',
      });
      // Navigation will happen automatically when auth state updates
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: error.message || 'Invalid matricula',
      });
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
            <CardTitle className="text-3xl font-bold">User Login</CardTitle>
            <CardDescription className="text-base mt-2">
              Sign in with your matricula
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
                    <FormLabel>Matricula</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your matricula"
                        {...field}
                        data-testid="input-matricula"
                        autoFocus
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
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sign In
              </Button>
            </form>
          </Form>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Administrator?
              </span>
            </div>
          </div>

          <Link to="/admin-login">
            <Button
              variant="outline"
              className="w-full"
              data-testid="link-admin-login"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              Admin Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
