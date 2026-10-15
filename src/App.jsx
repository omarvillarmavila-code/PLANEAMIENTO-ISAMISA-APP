import React from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import ModuleAccess from './components/ModuleAccess'
import Administration from './pages/administracion/Administration'
import Layout from './components/sidebar/Sidebar'
import GranjasAves from './pages/granjas/aves/GranjasAves'
import Incubacion from './pages/plantas/incubacion/Incubacion'
import Planning from './pages/Planning'
import Inicio from './pages/inicio/Inicio'
import Lumbra from './pages/granjas/lumbra/Lumbra'
import Reparticion from './pages/granjas/reparticion/Reparticion'
import Asia from './pages/granjas/asia/Asia'
import Carabayllo from './pages/granjas/carabayllo/Carabayllo'
import Ate from './pages/plantas/ate/Ate'
import Carapongo from './pages/plantas/carapongo/Carapongo'

function ProtectedRoute() {
  const { session, loading } = useAuth()
  if (loading) return <div className="loading-screen">Cargando Planeamiento…</div>
  return session ? <Outlet /> : <Navigate to="/login" replace />
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route element={<ProtectedRoute />}><Route element={<Layout />}>
      <Route index element={<ModuleAccess module="inicio"><Inicio /></ModuleAccess>} />
      <Route path="granjas-aves" element={<ModuleAccess module="granjas"><GranjasAves /></ModuleAccess>} />
      <Route path="granjas-aves/lumbra" element={<ModuleAccess module="lumbra"><Lumbra /></ModuleAccess>} />
      <Route path="granjas-aves/reparticion" element={<ModuleAccess module="reparticion"><Reparticion /></ModuleAccess>} />
      <Route path="granjas-aves/asia" element={<ModuleAccess module="asia"><Asia /></ModuleAccess>} />
      <Route path="granjas-aves/carabayllo" element={<ModuleAccess module="carabayllo"><Carabayllo /></ModuleAccess>} />
      <Route path="incubacion" element={<ModuleAccess module="incubacion"><Incubacion /></ModuleAccess>} />
      <Route path="incubacion/ate" element={<ModuleAccess module="ate"><Ate /></ModuleAccess>} />
      <Route path="incubacion/carapongo" element={<ModuleAccess module="carapongo"><Carapongo /></ModuleAccess>} />
      <Route path="planeamiento" element={<ModuleAccess module="planeamiento"><Planning /></ModuleAccess>} />
      <Route path="administracion" element={<ModuleAccess module="administracion"><Administration /></ModuleAccess>} />
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
