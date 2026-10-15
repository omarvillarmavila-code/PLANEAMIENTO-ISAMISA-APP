import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';
import { MODULES } from '../../security/modules';
import { functionErrorMessage } from '../../security/function-error';
import './administration.css';
const empty = () => ({ id: '', email: '', display_name: '', active: true, is_admin: false, permissions: { inicio: 'read' }, password: '' });
export default function Administration() {
  const { session } = useAuth();
  const { setup, refreshPermissions } = usePermissions();
  const [users, setUsers] = useState([]), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [search, setSearch] = useState(''), [editor, setEditor] = useState(null), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    if (setup) { setLoading(false); return; }
    let active = true;
    setLoading(true); setError('');
    supabase.rpc('app_admin_list_users').then(({ data, error: issue }) => {
      if (!active) return;
      if (issue) setError(issue.message); else setUsers(data ?? []);
      setLoading(false);
    }).catch(() => { if (active) { setError('No se pudieron cargar los usuarios.'); setLoading(false); } });
    return () => { active = false; };
  }, [setup, revision]);
  async function save(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = { target_id: editor.id, new_name: editor.display_name, new_active: editor.active, new_admin: editor.is_admin, new_permissions: editor.permissions };
      if (editor.id) {
        const { error: issue } = await supabase.rpc('app_admin_save_user', payload);
        if (issue) throw new Error(issue.message);
      } else {
        const { data, error: issue } = await supabase.functions.invoke('admin-users', { body: { action: 'create', ...editor } });
        if (issue) {
          throw new Error(await functionErrorMessage(issue));
        }
        if (data?.error) throw new Error(data.error);
      }
      setMessage(editor.id ? 'Usuario y permisos actualizados.' : 'Usuario creado.');
      const own = editor.id === session.user.id;
      setEditor(null); setRevision((v) => v + 1);
      if (own) refreshPermissions();
    } catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }
  if (setup) return <section className="page admin-page"><h2>Administración</h2><div className="panel"><h3>Activación inicial pendiente</h3><p>Primero se deben instalar las tablas de permisos y designar al administrador inicial en Supabase. Después podrás gestionar aquí los usuarios y sus accesos.</p><button onClick={refreshPermissions}>Comprobar activación</button></div></section>;
  const visible = users.filter((u) => `${u.email} ${u.display_name}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="page admin-page">
    <div className="page-heading"><div><h2>Administración</h2><p className="muted">Usuarios y permisos por módulo</p></div><button type="button" className="primary-button" disabled={busy} onClick={() => { setEditor(empty()); setError(''); setMessage(''); }}>Crear usuario</button></div>
    {error && <div className="admin-message error" role="alert">{error}</div>}
    {message && <div className="admin-message" role="status">{message}</div>}
    <div className="admin-layout">
      <section className="panel"><label className="admin-search">Buscar usuario<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Correo o nombre" /></label>
        {loading ? <p role="status">Cargando usuarios...</p> : <div className="table-scroll"><table><thead><tr><th>Usuario</th><th>Estado</th><th>Rol</th><th>Accesos</th><th /></tr></thead><tbody>{visible.map((user) => <tr key={user.id}>
          <td><strong>{user.display_name || user.email}</strong><small>{user.email}</small></td><td><span className={`admin-badge ${user.active ? 'active' : ''}`}>{user.active ? 'Activo' : 'Desactivado'}</span></td>
          <td>{user.is_admin ? 'Administrador' : 'Usuario'}</td><td>{user.is_admin ? 'Todos los módulos' : `${Object.keys(user.permissions).length} módulos`}</td>
          <td><button type="button" className="secondary-button" disabled={busy} onClick={() => { setEditor({ ...user, permissions: { ...user.permissions }, password: '' }); setError(''); }}>Editar</button></td>
        </tr>)}</tbody></table>{!visible.length && <p className="muted">No hay usuarios que coincidan con la búsqueda.</p>}</div>}
      </section>
      {editor && <form className="panel admin-editor" onSubmit={save}>
        <h3>{editor.id ? 'Editar usuario' : 'Crear usuario'}</h3>
        <fieldset disabled={busy}>
          <label>Nombre<input value={editor.display_name} maxLength={160} onChange={(e) => setEditor({ ...editor, display_name: e.target.value })} /></label>
          <label>Correo<input type="email" required readOnly={!!editor.id} value={editor.email} onChange={(e) => setEditor({ ...editor, email: e.target.value })} /></label>
          {!editor.id && <label>Contraseña inicial<input type="password" minLength={10} maxLength={256} autoComplete="new-password" required value={editor.password} onChange={(e) => setEditor({ ...editor, password: e.target.value })} /><small>Mínimo 10 caracteres.</small></label>}
          <label className="admin-check"><input type="checkbox" checked={editor.active} disabled={editor.id === session.user.id} onChange={(e) => setEditor({ ...editor, active: e.target.checked })} />Usuario activo</label>
          <label className="admin-check"><input type="checkbox" checked={editor.is_admin} disabled={editor.id === session.user.id} onChange={(e) => setEditor({ ...editor, is_admin: e.target.checked })} />Administrador general</label>
          <p className="muted">El administrador general puede gestionar todos los usuarios y módulos.</p>
          <div className="admin-permissions"><h4>Permisos por módulo</h4>{MODULES.map((module) => <label key={module.id}><span>{module.label}</span><select disabled={editor.is_admin} value={editor.permissions[module.id] ?? 'none'} onChange={(e) => setEditor({ ...editor, permissions: { ...editor.permissions, [module.id]: e.target.value } })}>
            <option value="none">Sin acceso</option><option value="read">Solo lectura</option><option value="edit">Edición</option>
          </select></label>)}</div>
          <div className="admin-actions"><button type="button" className="secondary-button" onClick={() => setEditor(null)}>Cancelar</button><button className="primary-button" type="submit">{busy ? 'Guardando...' : 'Guardar usuario'}</button></div>
        </fieldset>
      </form>}
    </div>
  </section>;
}
