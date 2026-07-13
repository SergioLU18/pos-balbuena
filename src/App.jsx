import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TabletShell } from './components/layout/TabletShell'
import MeseroFloorPage from './pages/mesero/MeseroFloorPage'
import MeseroOrdenPage from './pages/mesero/MeseroOrdenPage'
import CocinaPage from './pages/cocina/CocinaPage'
import { usePosData } from './hooks/usePosData'

function MeseroApp() {
  return (
    <TabletShell>
      <Routes>
        <Route index element={<MeseroFloorPage />} />
        <Route path="orden/:mesaId" element={<MeseroOrdenPage />} />
      </Routes>
    </TabletShell>
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
        {/* /admin/* se agrega en una fase futura */}
        <Route path="*" element={<Navigate to="/mesero" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
