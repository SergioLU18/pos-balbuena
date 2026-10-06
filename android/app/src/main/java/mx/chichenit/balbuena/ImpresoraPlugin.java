package mx.chichenit.balbuena;

import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;

/**
 * Impresión directa a la térmica por red: abre un socket TCP al puerto RAW (9100) de la
 * impresora y le escribe los bytes ESC/POS que ya armó el POS (src/lib/escpos.js).
 * Del lado web se usa a través de src/lib/impresora.js.
 */
@CapacitorPlugin(name = "Impresora")
public class ImpresoraPlugin extends Plugin {

    private static final int TIMEOUT_MS = 4000;

    /** imprimir({ host, puerto?, datos }) — datos en base64. */
    @PluginMethod
    public void imprimir(PluginCall call) {
        String host = call.getString("host");
        int puerto = call.getInt("puerto", 9100);
        String datos = call.getString("datos");
        if (host == null || host.isEmpty() || datos == null) {
            call.reject("Falta la IP de la impresora o los datos", "PARAMETROS");
            return;
        }
        byte[] bytes;
        try {
            bytes = Base64.decode(datos, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Datos de impresión inválidos", "PARAMETROS", e);
            return;
        }
        // Red fuera del hilo principal: Android no permite sockets en el hilo de la UI.
        new Thread(() -> {
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, puerto), TIMEOUT_MS);
                socket.setSoTimeout(TIMEOUT_MS);
                OutputStream out = socket.getOutputStream();
                out.write(bytes);
                out.flush();
                call.resolve();
            } catch (Exception e) {
                call.reject("No se pudo conectar con la impresora (" + host + ":" + puerto + ")", "CONEXION", e);
            }
        }).start();
    }

    /**
     * estado({ host, puerto? }) → { conectada, sinPapel, tapaAbierta, error }.
     * Pregunta con DLE EOT: n=2 (fuera de línea) y n=4 (papel). Si la impresora no contesta
     * a tiempo se reporta conectada pero sin detalle, porque algunos modelos genéricos
     * no responden a estos comandos por red.
     */
    @PluginMethod
    public void estado(PluginCall call) {
        String host = call.getString("host");
        int puerto = call.getInt("puerto", 9100);
        if (host == null || host.isEmpty()) {
            call.reject("Falta la IP de la impresora", "PARAMETROS");
            return;
        }
        new Thread(() -> {
            JSObject res = new JSObject();
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, puerto), TIMEOUT_MS);
                socket.setSoTimeout(1500);
                res.put("conectada", true);
                OutputStream out = socket.getOutputStream();
                InputStream in = socket.getInputStream();
                try {
                    out.write(new byte[]{0x10, 0x04, 0x02}); // estado fuera de línea
                    out.flush();
                    int offline = in.read();
                    out.write(new byte[]{0x10, 0x04, 0x04}); // estado del papel
                    out.flush();
                    int papel = in.read();
                    res.put("tapaAbierta", offline >= 0 && (offline & 0x04) != 0);
                    res.put("error", offline >= 0 && (offline & 0x40) != 0);
                    res.put("sinPapel", papel >= 0 && (papel & 0x60) != 0);
                    res.put("detalle", true);
                } catch (Exception sinRespuesta) {
                    res.put("detalle", false);
                }
                call.resolve(res);
            } catch (Exception e) {
                res.put("conectada", false);
                call.resolve(res);
            }
        }).start();
    }
}
