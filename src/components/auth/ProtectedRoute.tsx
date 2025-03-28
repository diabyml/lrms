// // src/components/auth/ProtectedRoute.tsx (Create directories if needed)
// import React from "react";
// import { Navigate, Outlet, useLocation } from "react-router-dom";
// import { useAuth } from "../../context/AuthContext";

// const ProtectedRoute: React.FC = () => {
//   const { session, loading } = useAuth();
//   const location = useLocation();

//   // Show loading indicator while session is being checked
//   if (loading) {
//     // Or a more sophisticated global loading spinner
//     return <div>Loading application...</div>;
//   }

//   // If there's no session, redirect to login page
//   // Pass the current location state so user can be redirected back after login
//   if (!session) {
//     return <Navigate to="/login" state={{ from: location }} replace />;
//   }

//   // If there is a session, render the child routes
//   return <Outlet />;
// };

// export default ProtectedRoute;

// src/components/auth/ProtectedRoute.tsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Import the loading icon
import { Loader2 } from "lucide-react";

const ProtectedRoute: React.FC = () => {
  const { session, loading } = useAuth();
  const location = useLocation();

  // Show loading indicator while session is being checked
  // Use the same styling as the LoginPage initial auth loading
  if (loading) {
    return (
      // Mimic the centering and background from LoginPage's auth loading state
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-200">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        {/* Using French text for consistency */}
        <span className="ml-2 text-muted-foreground">
          Chargement de l'application...
        </span>
      </div>
    );
  }

  // If there's no session, redirect to login page
  // Pass the current location state so user can be redirected back after login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If there is a session, render the child routes within the designated layout
  // The Outlet here will render the <Route element={<MainLayout />}> from App.tsx
  return <Outlet />;
};

export default ProtectedRoute;
