import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSuperuser?: boolean;
}

export default function ProtectedRoute({
  children,
  requireSuperuser = false,
}: ProtectedRouteProps) {
  const { user, loading, isAdmin, isSuperuser } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireSuperuser && !isSuperuser) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
