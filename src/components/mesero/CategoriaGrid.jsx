import { JbFlor } from '../ui/JbFlor'

/** Antes de elegir categoría: botones grandes a pantalla completa, fáciles de tocar. */
function CategoriaGridGrande({ categorias, onSelect }) {
  return (
    <div
      className="jb-fade-up h-full no-scrollbar"
      style={{
        overflowY: 'auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gridAutoRows: 'minmax(140px, 1fr)',
        gap: 18,
      }}
    >
      {categorias.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          style={{
            background: '#fff',
            border: '3px solid var(--jb-line)',
            borderRadius: 26,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '24px 26px',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: "'Inter Tight', sans-serif",
            transition: 'transform 0.1s ease',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <JbFlor size={30} />
          <span style={{ fontSize: 26, fontWeight: 900, color: 'var(--jb-ink)' }}>{cat}</span>
        </button>
      ))}
    </div>
  )
}

/** Ya con una categoría elegida: las mismas categorías se recorren a una franja
 *  compacta pero siempre visible — así, si el mesero se equivoca, puede tocar
 *  otra categoría al instante sin tener que "regresar" a ningún lado. */
function CategoriaFranja({ categorias, activa, onSelect }) {
  return (
    <div className="flex no-scrollbar" style={{ gap: 10, overflowX: 'auto', padding: '2px 2px 6px' }}>
      {categorias.map((cat) => {
        const isActive = cat === activa
        return (
          <button
            key={cat}
            onClick={() => onSelect(cat)}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: "'Inter Tight', sans-serif",
              fontSize: 18,
              fontWeight: 800,
              padding: '16px 24px',
              borderRadius: 18,
              cursor: 'pointer',
              border: isActive ? '3px solid var(--jb-pink)' : '3px solid var(--jb-line)',
              background: isActive ? 'var(--jb-pink)' : '#fff',
              color: isActive ? '#fff' : 'var(--jb-ink)',
              transition: 'all 0.15s ease',
            }}
          >
            <JbFlor size={20} color={isActive ? '#fff' : 'var(--jb-pink)'} petals={isActive ? 'var(--jb-pink)' : '#fff'} />
            {cat}
          </button>
        )
      })}
    </div>
  )
}

export function CategoriaGrid({ categorias, activa, onSelect, compact }) {
  return compact
    ? <CategoriaFranja categorias={categorias} activa={activa} onSelect={onSelect} />
    : <CategoriaGridGrande categorias={categorias} onSelect={onSelect} />
}
