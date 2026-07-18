import { useAuthContext } from "@/context/AuthContext";

// Shared auth state across the app. Backed by AuthProvider in __root.
export function useAuth() {
  return useAuthContext();
}
