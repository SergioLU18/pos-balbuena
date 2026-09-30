export const MESAS = Array.from({ length: 15 }, (_, i) => ({
  id: `mesa-${i + 1}`,
  numero: String(i + 1),
  activo: true,
}))
