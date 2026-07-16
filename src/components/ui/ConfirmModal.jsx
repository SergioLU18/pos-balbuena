import { Button } from './Button'

// Diálogo de confirmación reutilizable, con el mismo lenguaje visual que el resto de
// los pop-ups (EntregadosModal, ConfigurarPlatilloModal): reemplaza a window.confirm
// para acciones que conviene explicar antes de ejecutarlas. Clic fuera o Cancelar
// cierran sin hacer nada; `danger` tiñe de rojo el botón de confirmar para acciones
// destructivas (p. ej. quitar un platillo).
export function ConfirmModal({
  titulo,
  mensaje,
  confirmarLabel = 'Confirmar',
  cancelarLabel = 'Cancelar',
  danger = false,
  onConfirm,
  onClose,
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(51,34,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20,
      }}
    >
      <div
        className="jb-pop"
        style={{
          background: '#fff', borderRadius: 26, width: 440, maxWidth: '100%',
          fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
          padding: '28px 30px', display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--jb-ink)' }}>{titulo}</h2>
        {mensaje && (
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--jb-ink-soft)' }}>{mensaje}</p>
        )}
        <div className="flex" style={{ gap: 12, marginTop: 8 }}>
          <Button variant="secondary" size="md" onClick={onClose} style={{ flex: 1 }}>
            {cancelarLabel}
          </Button>
          <Button
            size="md"
            onClick={onConfirm}
            style={{ flex: 1, ...(danger ? { background: '#C24A4A', color: '#fff' } : {}) }}
          >
            {confirmarLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
