import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  /**
   * Whether the last sign-out was one nobody asked for.
   *
   * Being returned to the login screen without explanation reads as the app
   * losing your work. It is the same screen either way, so the difference has to
   * be carried across.
   */
  const [sessionExpired, setSessionExpired] = useState(false);
  const queryClient = useQueryClient();

  /**
   * Set just before the app asks to sign out, so that a `SIGNED_OUT` arriving
   * without it can be recognised as one nobody asked for.
   *
   * This is what makes both routes to an ended session look the same from here:
   * supabase-js giving up on a refresh, and `lib/sessionGuard.js` signing out
   * after a request came back with a token the server no longer honours. Only
   * the button in Settings sets the flag.
   */
  const askedToSignOut = useRef(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data?.session ?? null);
      })
      .catch(() => {
        setSession(null);
      })
      .finally(() => {
        setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      if (event === 'SIGNED_OUT') {
        // Whoever signs in next gets their own data. Without this the cache
        // outlives the session by its ten-minute `gcTime`, so a second account
        // on the same phone opens onto the first one's growspaces and keeps
        // showing them until every query has come back.
        queryClient.clear();
        setSessionExpired(!askedToSignOut.current);
        askedToSignOut.current = false;
      }

      if (event === 'SIGNED_IN') setSessionExpired(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, [queryClient]);

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });

  const signUp = (email, password) => supabase.auth.signUp({ email, password });

  const signOut = () => {
    askedToSignOut.current = true;
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, loading, sessionExpired, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
