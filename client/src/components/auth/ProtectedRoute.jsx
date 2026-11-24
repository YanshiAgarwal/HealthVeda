// Wrap pages that need a login. Visitors are sent to /login and come back after.
import { Navigate, useLocation } from "react-router-dom";
import { Leaf } from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";

export function FullPageLoader() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Leaf className="animate-pulse text-leaf-400" size={40} />
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
