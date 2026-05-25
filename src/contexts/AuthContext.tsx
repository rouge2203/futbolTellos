import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type Role = "superuser" | "admin" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: Role;
  isSuperuser: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchRole(userId: string): Promise<Role> {
  const { data, error } = await supabase
    .from("admin_usuarios")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.role === "superuser" || data.role === "admin" ? data.role : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function applySession(s: Session | null) {
      if (cancelled) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const r = await fetchRole(s.user.id);
        if (!cancelled) setRole(r);
      } else if (!cancelled) {
        setRole(null);
      }
      if (!cancelled) setLoading(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    role,
    isSuperuser: role === "superuser",
    isAdmin: role === "superuser" || role === "admin",
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
