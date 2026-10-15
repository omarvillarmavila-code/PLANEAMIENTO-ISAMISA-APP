import React, { useState } from 'react'
import { usePermissions } from '../../../context/PermissionsContext'
import AvesDataTable from './components/AvesDataTable'
import CargaCSVGranja from '../Componentes Tools/01 Carga de CSV Granja'

export default function GranjasAves() {
  const { can } = usePermissions()
  const [revision, setRevision] = useState(0)
  return <section className="page"><div className="page-heading"><h2>Granjas Aves</h2></div>{can('granjas', 'edit') && <CargaCSVGranja onImported={() => setRevision((value) => value + 1)} />}<div className="farm-tables" key={revision}><AvesDataTable title="Reproductoras" tipo="reproductoras" /><AvesDataTable title="Engorde" tipo="engorde" /></div></section>
}
