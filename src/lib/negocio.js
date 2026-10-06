// Datos fiscales y de contacto que encabezan los tickets impresos.
// Temporal: van a vivir en una tabla de configuración en Supabase para poder editarlos
// desde Ajustes sin tocar código (ver TODO-impresion.md).
export const NEGOCIO = {
  nombre: 'Jardín Balbuena',
  razonSocial: 'María Guadalupe Licea Peréz Peña',
  rfc: 'LIPG501207H6A',
  curp: 'LIPG501207MDFCRD05',
  regimen: 'Régimen de las Personas Físicas con Actividades Empresariales y Profesionales',
  direccion: ['Calle 20 No. 45D x 1G Col. México Norte', 'Mérida, Yuc. Méx. C.P. 97128'],
  telefonos: 'Tel. 9999 444 931 y 9995 659 663',
}
