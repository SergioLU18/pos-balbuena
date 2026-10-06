import Foundation
import Capacitor
import Network

/// Impresión directa a la térmica por red: abre una conexión TCP al puerto RAW (9100) de
/// la impresora y le escribe los bytes ESC/POS que ya armó el POS (src/lib/escpos.js).
/// Del lado web se usa a través de src/lib/impresora.js. Es el gemelo de
/// android/.../ImpresoraPlugin.java: mismos métodos, mismos parámetros, mismas respuestas.
@objc(ImpresoraPlugin)
public class ImpresoraPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ImpresoraPlugin"
    public let jsName = "Impresora"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "imprimir", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "estado", returnType: CAPPluginReturnPromise),
    ]

    private let cola = DispatchQueue(label: "mx.chichenit.balbuena.impresora")
    private let timeoutConexion: TimeInterval = 4
    private let timeoutRespuesta: TimeInterval = 1.5

    /// imprimir({ host, puerto?, datos }) — datos en base64.
    @objc func imprimir(_ call: CAPPluginCall) {
        guard let host = call.getString("host"), !host.isEmpty,
              let datos = call.getString("datos") else {
            call.reject("Falta la IP de la impresora o los datos", "PARAMETROS")
            return
        }
        guard let bytes = Data(base64Encoded: datos) else {
            call.reject("Datos de impresión inválidos", "PARAMETROS")
            return
        }
        let puerto = call.getInt("puerto") ?? 9100
        conectar(host: host, puerto: puerto) { conexion in
            guard let conexion = conexion else {
                call.reject("No se pudo conectar con la impresora (\(host):\(puerto))", "CONEXION")
                return
            }
            // isComplete: true cierra el envío después de los datos, así cancel() no corta
            // el ticket a la mitad.
            conexion.send(content: bytes, isComplete: true, completion: .contentProcessed { error in
                conexion.cancel()
                if let error = error {
                    call.reject("No se pudo enviar el ticket: \(error.localizedDescription)", "CONEXION")
                } else {
                    call.resolve()
                }
            })
        }
    }

    /// estado({ host, puerto? }) → { conectada, sinPapel, tapaAbierta, error, detalle }.
    /// Pregunta con DLE EOT: n=2 (fuera de línea) y n=4 (papel). Si la impresora no contesta
    /// a tiempo se reporta conectada pero sin detalle, porque algunos modelos genéricos no
    /// responden a estos comandos por red.
    @objc func estado(_ call: CAPPluginCall) {
        guard let host = call.getString("host"), !host.isEmpty else {
            call.reject("Falta la IP de la impresora", "PARAMETROS")
            return
        }
        let puerto = call.getInt("puerto") ?? 9100
        conectar(host: host, puerto: puerto) { [weak self] conexion in
            guard let self = self, let conexion = conexion else {
                call.resolve(["conectada": false])
                return
            }
            self.preguntar(conexion, [0x10, 0x04, 0x02]) { offline in
                self.preguntar(conexion, [0x10, 0x04, 0x04]) { papel in
                    conexion.cancel()
                    guard let offline = offline, let papel = papel else {
                        call.resolve(["conectada": true, "detalle": false])
                        return
                    }
                    call.resolve([
                        "conectada": true,
                        "detalle": true,
                        "tapaAbierta": offline & 0x04 != 0,
                        "error": offline & 0x40 != 0,
                        "sinPapel": papel & 0x60 != 0,
                    ])
                }
            }
        }
    }

    /// Abre la conexión TCP y llama a `listo` exactamente una vez: con la conexión cuando
    /// queda lista, o con nil si falla o no responde a tiempo.
    private func conectar(host: String, puerto: Int, listo: @escaping (NWConnection?) -> Void) {
        guard let port = NWEndpoint.Port(rawValue: UInt16(clamping: puerto)) else {
            listo(nil)
            return
        }
        let conexion = NWConnection(host: NWEndpoint.Host(host), port: port, using: .tcp)
        var terminado = false // solo se toca desde `cola`
        let terminar: (NWConnection?) -> Void = { resultado in
            if terminado { return }
            terminado = true
            if resultado == nil { conexion.cancel() }
            listo(resultado)
        }
        conexion.stateUpdateHandler = { estado in
            switch estado {
            case .ready: terminar(conexion)
            case .failed, .cancelled: terminar(nil)
            // .waiting: no hay ruta a la impresora (otra red, apagada). NWConnection seguiría
            // reintentando para siempre; el timeout de abajo lo corta.
            default: break
            }
        }
        conexion.start(queue: cola)
        cola.asyncAfter(deadline: .now() + timeoutConexion) { terminar(nil) }
    }

    /// Manda un comando y espera un byte de respuesta (nil si no llega a tiempo).
    private func preguntar(_ conexion: NWConnection, _ comando: [UInt8], respuesta: @escaping (UInt8?) -> Void) {
        var terminado = false // solo se toca desde `cola`
        let terminar: (UInt8?) -> Void = { byte in
            if terminado { return }
            terminado = true
            respuesta(byte)
        }
        conexion.send(content: Data(comando), completion: .contentProcessed { error in
            if error != nil { terminar(nil); return }
            conexion.receive(minimumIncompleteLength: 1, maximumLength: 1) { data, _, _, _ in
                terminar(data?.first)
            }
        })
        cola.asyncAfter(deadline: .now() + timeoutRespuesta) { terminar(nil) }
    }
}

/// El controlador de Capacitor con los plugins propios de la app registrados (los que no
/// vienen de npm). SceneDelegate lo usa como raíz en lugar de CAPBridgeViewController.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(ImpresoraPlugin())
    }
}
