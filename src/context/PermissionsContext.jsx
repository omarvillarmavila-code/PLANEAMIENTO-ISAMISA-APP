import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { hasAccess } from '../security/modules';
const Context = createContext(null);
export function PermissionsProvider({ children }) {
  const { session } = useAuth();
  const [state, setState] = useState({ loading: true });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    if (!session?.user?.id || !supabase) { setState({ loading: false, access: null }); return; }
    const userId = session.user.id;
    setState((old) => old.userId === userId ? old : { loading: true, userId, access: null });
    supabase.rpc('app_my_access').then(({ data, error }) => {
      if (!active) return;
      if (error) setState(['PGRST202', '42883'].includes(error.code)
        ? { loading: false, setup: true, userId, access: null }
        : { loading: false, userId, error: 'No se pudieron comprobar tus permisos. Vuelve a intentarlo.', access: null });
      else setState({ loading: false, userId, access: data });
    }).catch(() => { if (active) setState({ loading: false, userId, error: 'No se pudieron comprobar tus permisos.', access: null }); });
    return () => { active = false; };
  }, [session?.user?.id, revision]);
  useEffect(() => {
    const refresh = () => setRevision((v) => v + 1);
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 60000);
    return () => { window.removeEventListener('focus', refresh); clearInterval(timer); };
  }, []);
  const can = (module, action = 'read') => state.userId !== session?.user?.id ? false : state.setup ? !!session && action === 'read' : hasAccess(state.access, module, action);
  return <Context.Provider value={{ ...state, loading: state.loading || !!session && state.userId !== session.user.id, can, refreshPermissions: () => setRevision((v) => v + 1) }}>{children}</Context.Provider>;
}
export const usePermissions = () => useContext(Context);
