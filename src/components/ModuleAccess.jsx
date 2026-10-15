import React from 'react';
import { usePermissions } from '../context/PermissionsContext';
export default function ModuleAccess({ module, children }) {
  const { loading, error, can, refreshPermissions } = usePermissions();
  if (loading) return <div className="panel" role="status">Comprobando permisos...</div>;
  if (error) return <div className="panel" role="alert"><p>{error}</p><button onClick={refreshPermissions}>Reintentar</button></div>;
  if (!can(module)) return <div className="page"><div className="panel" role="alert"><h2>Sin acceso</h2><p>Tu usuario no tiene permiso para este módulo. Solicita acceso al administrador.</p></div></div>;
  return children;
}
