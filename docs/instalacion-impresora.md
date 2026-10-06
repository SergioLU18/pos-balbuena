# Instalación de la impresora de tickets

Cómo dejar funcionando la impresora térmica (HSTEM 80 mm) con las tablets del
restaurante. Se hace una sola vez. Toma unos 30 minutos.

**Qué se necesita**
- La impresora, su cable de corriente y un cable de red (Ethernet).
- Acceso al módem del restaurante (estar junto a él; a veces la contraseña de su
  página de configuración viene en una etiqueta abajo del módem).
- Las tablets, conectadas al wifi del restaurante.
- El archivo de la app (`jardin-balbuena.apk`).

---

## Parte 1 · Conectar la impresora al módem

1. Conecta el cable de red de la impresora a uno de los puertos **LAN** del módem
   (los amarillos o numerados; **no** el que dice WAN / Internet).
2. Prende la impresora.

### Saber qué IP tiene la impresora

3. Apaga la impresora.
4. Mantén presionado el botón **FEED** y, sin soltarlo, prende la impresora.
5. Suelta FEED cuando empiece a imprimir. Sale una hoja de configuración.
6. Busca en la hoja algo como **IP Address: 192.168.1.87**. Anótalo. Si la hoja
   también dice **DHCP: Enable/Disable**, anótalo también.

### Saber qué red usa el módem

7. En una tablet: **Ajustes → Wi-Fi →** toca la red del restaurante **→ Avanzado**
   (o el ícono de engrane). Busca la **Dirección IP**, por ejemplo `192.168.1.34`.
8. Compara los **tres primeros números** de las dos IP:

| Impresora | Tablet | ¿Sirve? |
|---|---|---|
| 192.168.**1**.87 | 192.168.**1**.34 | ✅ Sí: están en la misma red. Sigue a la Parte 2. |
| 192.168.**123**.100 | 192.168.**1**.34 | ❌ No: la impresora trae una IP de fábrica de otra red. Hay que cambiarla (abajo). |

### Si hay que cambiarle la IP a la impresora

La forma más segura es desde una computadora con Windows y la impresora conectada
por USB, con la herramienta del fabricante (suele llamarse *Printer Tool*,
*POS Printer Setting* o similar, y viene en el CD o en la página del vendedor).
Ahí se escribe:

- **IP**: los tres primeros números de la red del módem + un número alto que nadie
  use, por ejemplo **192.168.1.200**.
- **Máscara (Subnet mask)**: `255.255.255.0`
- **Puerta de enlace (Gateway)**: la IP del módem, normalmente los tres primeros
  números + `.1` o `.254` (por ejemplo `192.168.1.254` en Telmex).
- **DHCP**: desactivado (*Disable*), para que la IP no cambie nunca.

Guarda, reinicia la impresora y vuelve a imprimir la hoja de configuración (pasos
3 a 5) para confirmar que ya tiene la IP nueva.

> Si la impresora ya estaba en la misma red pero con **DHCP: Enable**, conviene
> igual fijarle la IP de esta forma: con DHCP el módem le puede cambiar la IP un día
> y las tablets dejarían de encontrarla.

### Revisar el wifi de las tablets

- Las tablets deben estar conectadas a la red **principal** del módem. **No** a la
  red de invitados (*Guest* / *Invitados*): esa red no deja que los aparatos se vean
  entre sí, y las tablets no encontrarían la impresora.

---

## Parte 2 · Instalar la app en cada tablet

La app no está en Play Store; se instala con el archivo `.apk`.

1. Pasa el archivo `jardin-balbuena.apk` a la tablet (descargándolo del enlace que
   te mandemos, por WhatsApp, o por USB).
2. Ábrelo desde **Archivos → Descargas**.
3. Android va a avisar que la instalación de apps de origen desconocido está
   bloqueada. Toca **Ajustes** y activa **Permitir de esta fuente**, regresa y toca
   **Instalar**.
4. Si aparece *Play Protect* diciendo que la app no es conocida, toca
   **Más detalles → Instalar de todas formas**.
5. Abre la app **Jardín Balbuena**. Es el mismo POS de siempre; entra con tu PIN.

Repite en cada tablet.

### Si son iPads

La app se instala desde el enlace o la invitación que te mandemos (TestFlight o
instalación directa). Después:

1. Abre la app **Jardín Balbuena**.
2. La primera vez que imprimas, iPadOS pregunta *"¿Permitir que Jardín Balbuena
   encuentre dispositivos en tu red local?"*. Toca **Permitir**. Sin ese permiso no
   puede llegar a la impresora.
3. Si por error se tocó *No permitir*: **Configuración → Privacidad y seguridad →
   Red local →** activa **Jardín Balbuena**.

---

## Parte 3 · Configurar la impresora en la app

En cada tablet (solo la primera vez):

1. Entra a **Ajustes → Impresora** (pide el PIN de administrador).
2. Escribe la **IP de la impresora** (la de la Parte 1). El puerto se queda en **9100**.
3. Toca **Guardar**.
4. Toca **Probar conexión**. Debe decir *Conectada*.
5. Toca **Imprimir prueba**. Debe salir un ticket de prueba.

Listo: desde ahora **Imprimir cuenta** en una mesa imprime la pre-cuenta.

---

## Problemas comunes

| Qué pasa | Qué revisar |
|---|---|
| *No responde en 192.168.x.x:9100* | Que la impresora esté prendida y con su cable de red conectado (con luz en el puerto). Que la tablet esté en el wifi principal, no en el de invitados. Que la IP escrita sea la de la hoja de configuración. |
| Antes imprimía y de repente ya no | El módem se reinició y le dio otra IP a la impresora: vuelve a imprimir la hoja (Parte 1) y fija la IP con DHCP desactivado. |
| *Sin papel* o *tapa abierta* | Cambia el rollo (papel térmico 80 mm, el lado brillante hacia afuera) y cierra bien la tapa. |
| Salen símbolos raros en lugar de acentos | Avísanos: es un ajuste en la app, no en la impresora. |
| *Para imprimir abre el POS desde la app de la tablet* | Estás usando el POS en Chrome. Ábrelo desde el ícono de la app **Jardín Balbuena**. |
| En iPad no conecta aunque todo lo demás está bien | Permiso de red local: **Configuración → Privacidad y seguridad → Red local →** activa **Jardín Balbuena**. |
| La app no abre o se queda en blanco | Revisa el internet del restaurante: la app necesita internet, igual que el POS en el navegador. |
