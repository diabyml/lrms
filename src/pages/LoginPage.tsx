// src/pages/LoginPage.tsx
import React, { useState, FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

// Import shadcn/ui components and an icon
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, FlaskConical } from "lucide-react"; // Icons for loading, error, and logo

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  //   const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (signInError) {
        throw signInError;
      }
      // Navigation is handled by the ProtectedRoute/App logic detecting the session change
      // navigate('/patients'); // Explicit navigation likely not needed
    } catch (err: unknown) {
      console.error("Login error:", err);
      // Provide a user-friendly error message in French
      setError(
        err instanceof Error && err.message === "Invalid login credentials"
          ? "Identifiants invalides. Veuillez vérifier votre email et mot de passe."
          : "Échec de la connexion. Une erreur est survenue."
      );
    } finally {
      setLoading(false);
    }
  };

  // 1. Show loading indicator while checking initial auth state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  // 2. Redirect if user is already logged in
  if (session) {
    return <Navigate to="/patients" replace />; // Redirect to main app page
  }

  // 3. Render Login Form
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-blue-100 p-4">
      {/* Added padding */}
      <Card className="w-full max-w-md shadow-xl border-t-4 border-primary rounded-lg overflow-hidden">
        {/* Enhanced Card styling */}
        <CardHeader className="text-center p-6 bg-muted/30">
          {/* Centered header with background */}
          <div className="mx-auto mb-4">
            <FlaskConical className="h-12 w-12 text-primary" /> {/* App Icon */}
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Connexion LRMS {/* Changed title */}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Accédez à votre espace laboratoire sécurisé.{" "}
            {/* Updated description */}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="p-6 space-y-6">
            {" "}
            {/* Increased spacing */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              {" "}
              {/* Consistent spacing for label+input */}
              <Label htmlFor="email" className="font-semibold">
                Adresse e-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="votreadresse@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-10" // Slightly taller input
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-semibold">
                Mot de passe
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Votre mot de passe"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-10"
              />
              {/* Optional: Add "Forgot password?" link here later */}
            </div>
          </CardContent>
          <CardFooter className="p-6 bg-muted/30">
            {/* Footer with background */}
            <Button
              type="submit"
              className="w-full h-11 text-base font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
