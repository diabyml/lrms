// src/context/AuthContext.tsx (Create directories if needed)

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient"; // Import your Supabase client

// Define the shape of the context value
interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  // You could add login/logout functions here, but often they are called directly
  // where needed using the supabase client. Keeping it simple for now.
}

// Create the context with an initial default value (or undefined)
// Using 'null' as default for session/user initially
const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true, // Start in loading state until session is checked
});

// Define the props for the provider component
interface AuthProviderProps {
  children: ReactNode;
}

// Create the provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. Check for initial session synchronously
    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false); // Initial check done

        // 2. Set up the auth state change listener
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, newSession) => {
          console.log("Auth state changed:", _event, newSession); // For debugging
          setSession(newSession);
          setUser(newSession?.user ?? null);
          // No need to setLoading here unless it's the very first event
          // and the initial check hasn't finished (edge case)
        });

        // Cleanup function to unsubscribe when the component unmounts
        return () => {
          subscription?.unsubscribe();
        };
      })
      .catch((error) => {
        console.error("Error getting initial session:", error);
        setLoading(false); // Ensure loading is false even on error
      });
  }, []); // Empty dependency array ensures this runs only once

  const value = {
    session,
    user,
    loading,
  };

  // Render children only after initial loading is complete to avoid flashes
  // Or, render a global loading indicator if preferred
  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Or: {!loading ? children : <GlobalSpinner />} */}
    </AuthContext.Provider>
  );
};

// Create a custom hook for easy access to the context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
