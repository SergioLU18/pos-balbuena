import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TabletShell } from './components/layout/TabletShell'
import { MeseroGate } from './components/layout/MeseroGate'
import MeseroFloorPage from './pages/mesero/MeseroFloorPage'
import MeseroOrdenPage from './pages/mesero/MeseroOrdenPage'
import LlevarPage from './pages/mesero/LlevarPage'
import LlevarOrdenPage from './pages/mesero/LlevarOrdenPage'
import CocinaPage from './pages/cocina/CocinaPage'
import AdminApp from './pages/admin/AdminApp'
import { usePosData } from './hooks/usePosData'

function MeseroApp() {
  return (
    <MeseroGate>
      <TabletShell>
        <Routes>
          <Route index element={<MeseroFloorPage />} />
          <Route path="orden/:mesaId" element={<MeseroOrdenPage />} />
          {/* Para llevar: mismo turno y mismo mesero que las mesas (por eso va dentro
              del gate y del shell), pero la orden se identifica por el CLIENTE y no por
              una mesa — de ahí su propia rama de rutas. */}
          <Route path="llevar" element={<LlevarPage />} />
          <Route path="llevar/orden/:ordenId" element={<LlevarOrdenPage />} />
        </Routes>
      </TabletShell>
    </MeseroGate>
  )
}

export default function App() {
  // Carga inicial + sincronización en tiempo real desde Supabase (no-op en modo mock).
  usePosData()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/mesero" replace />} />
        <Route path="/mesero/*" element={<MeseroApp />} />
        <Route path="/cocina" element={<CocinaPage />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/mesero" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
