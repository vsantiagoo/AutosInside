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

const adminLoginSchema = z.object({
  matricula: z.string()
    .min(1, "Matricula is required")
    .trim()
    .toUpperCase(),
  password: z.string()
    .min(1, "Password is required")
    .min(3, "Password must be at least 3 characters"),
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
        title: 'Welcome back, Administrator!',
        description: 'You have successfully logged in.',
      });
      // Navigation will happen automatically when auth state updates
    } catch (error: any) {
      // Provide more specific error messages
      let errorMessage = 'Invalid credentials';
      
      if (error.message?.includes('not found')) {
        errorMessage = 'User account not found';
      } else if (error.message?.includes('password')) {
        errorMessage = 'Incorrect password';
      } else if (error.message?.includes('admin')) {
        errorMessage = 'This account is not an administrator';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        variant: 'destructive',
        title: 'Login failed',
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
            <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center">
              <span className="material-icons text-white text-4xl">admin_panel_settings</span>
            </div>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">Admin Login</CardTitle>
            <CardDescription className="text-base mt-2">
              Sign in with your matricula and password
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
                        autoComplete="username"
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        aria-label="Administrator matricula"
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
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          {...field}
                          data-testid="input-password"
                          autoComplete="current-password"
                          aria-label="Administrator password"
                          aria-required="true"
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          tabIndex={-1}
                          aria-label={showPassword ? "Hide password" : "Show password"}
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
                aria-label="Sign in as administrator"
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sign In as Admin
              </Button>
            </form>
          </Form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Not an admin?
              </span>
            </div>
          </div>

          <Link to="/">
            <Button
              variant="outline"
              className="w-full"
              data-testid="link-user-login"
              aria-label="Switch to user login"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              User Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
