export const MODULES = [
  { id: 'inicio', label: 'Inicio', path: '/' },
  { id: 'granjas', label: 'Granjas y carga de registros', path: '/granjas-aves' },
  { id: 'lumbra', label: 'Granja Lumbra', path: '/granjas-aves/lumbra' },
  { id: 'reparticion', label: 'Granja Repartición', path: '/granjas-aves/reparticion' },
  { id: 'asia', label: 'Granja Asia', path: '/granjas-aves/asia' },
  { id: 'carabayllo', label: 'Granja Carabayllo', path: '/granjas-aves/carabayllo' },
  { id: 'incubacion', label: 'Incubación', path: '/incubacion' },
  { id: 'ate', label: 'Planta Ate', path: '/incubacion/ate' },
  { id: 'carapongo', label: 'Planta Carapongo', path: '/incubacion/carapongo' },
  { id: 'planeamiento', label: 'Planeamiento', path: '/planeamiento' },
];
export function moduleForPath(path) {
  return path === '/administracion' ? 'administracion' : MODULES.find((m) => m.path === path)?.id;
}
export function hasAccess(access, module, action = 'read') {
  if (!module || !access?.active) return false;
  if (access.is_admin) return true;
  if (module === 'administracion') return false;
  const level = access.permissions?.[module] ?? 'none';
  return action === 'edit' ? level === 'edit' : ['read', 'edit'].includes(level);
}
export function filterNavigation(items, can) {
  return items.flatMap((item) => {
    if (!item.children) return can(moduleForPath(item.path)) ? [item] : [];
    const children = item.children.filter((child) => can(moduleForPath(child.path)));
    const own = item.path && can(moduleForPath(item.path));
    return children.length || own ? [{ ...item, path: own ? item.path : children[0]?.path, children }] : [];
  });
}
