// Piezas de formulario compartidas por las pantallas de admin (meseros y menú):
// un contenedor de modal con la misma estética que los demás pop-ups, un campo
// etiquetado y un toggle de checkbox.
export function ModalShell({ titulo, children, onClose, width = 560 }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(51,34,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
      }}
    >
      <div
        className="jb-pop no-scrollbar"
        style={{
          background: '#fff', borderRadius: 26, width, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto',
          fontFamily: "'Inter Tight', sans-serif", boxShadow: '0 24px 60px rgba(51,34,42,0.3)',
          padding: '26px 28px 30px', display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div className="flex items-start justify-between">
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'var(--jb-ink)' }}>{titulo}</h2>
          <button
            onClick={onClose}
            style={{ background: 'var(--jb-pink-light)', border: 'none', borderRadius: 12, width: 38, height: 38, fontSize: 17, fontWeight: 800, color: 'var(--jb-pink-dark)', cursor: 'pointer' }}
          >✕</button>
        </div>
        {children}
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
    <label className="flex items-center" style={{ gap: 10, cursor: 'pointer', fontSize: 15, fontWeight: 700, color: 'var(--jb-ink)' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--jb-pink)' }} />
      {label}
    </label>
  )
}
