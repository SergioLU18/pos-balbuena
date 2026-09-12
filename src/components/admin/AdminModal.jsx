// Piezas de formulario compartidas por las pantallas de admin (meseros y menú):
// un contenedor de modal con la misma estética que los demás pop-ups, un campo
// etiquetado y un toggle de checkbox.
//
// Header (título) y `footer` (si se pasa) quedan fijos; solo `children`, en medio,
// hace scroll — así un formulario largo no se traga los botones de Cancelar/Guardar
// ni el título. Los modales que no pasan `footer` (la mayoría) se comportan igual
// que antes, solo que ahora el título no se va con el scroll.
export function ModalShell({ titulo, children, footer, onClose, width = 560 }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(51,34,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
      }}
    >
      <div
        className="jb-pop"
        style={{
          background: '#fff', borderRadius: 26, width, maxWidth: '100%', maxHeight: '92vh',
          fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div className="flex items-start justify-between" style={{ gap: 12, flexShrink: 0, padding: '26px 28px 16px' }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--jb-ink)' }}>{titulo}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{ background: 'var(--jb-pink-light)', border: 'none', borderRadius: 12, width: 44, height: 44, flexShrink: 0, fontSize: 17, fontWeight: 800, color: 'var(--jb-pink-dark)', cursor: 'pointer' }}
          >✕</button>
        </div>

        <div
          className="no-scrollbar"
          style={{
            overflowY: 'auto', flex: 1, minHeight: 0,
            display: 'flex', flexDirection: 'column', gap: 16,
            padding: `0 28px ${footer ? 16 : 30}px`,
          }}
        >
          {children}
        </div>

        {footer && (
          <div style={{ flexShrink: 0, padding: '14px 28px 26px', borderTop: '1.5px solid var(--jb-line)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function Campo({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--jb-gray)' }}>{label}</span>
      {children}
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center" style={{ gap: 12, minHeight: 44, padding: '6px 0', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: 'var(--jb-ink)' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 24, height: 24, flexShrink: 0, accentColor: 'var(--jb-pink)' }} />
      {label}
    </label>
  )
}
