# Trabajador de la herramienta de revisión (lo lanza tools/revision/fotos.mjs; no se usa a mano).
#   python trabajador.py fondo   → quita el fondo con rembg (deja PNG con transparencia)
#   python trabajador.py codigo  → lee códigos de barras con zxing-cpp
# Recibe una orden JSON por línea en la entrada y responde una línea JSON.
import json
import sys


def responder(datos):
    sys.stdout.write(json.dumps(datos, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def modo_fondo():
    try:
        from rembg import new_session, remove
        from PIL import Image
    except Exception as e:  # rembg no instalado
        responder({"listo": False, "error": f"rembg no disponible: {e}"})
        return
    sesion = None
    responder({"listo": True})
    for linea in sys.stdin:
        try:
            orden = json.loads(linea)
            if sesion is None:
                sesion = new_session("u2net")
            imagen = Image.open(orden["entrada"]).convert("RGB")
            salida = remove(imagen, session=sesion)
            salida.save(orden["salida"], "PNG")
            responder({"id": orden.get("id"), "ok": True})
        except Exception as e:
            responder({"id": orden.get("id") if isinstance(orden, dict) else None, "ok": False, "error": str(e)})


def modo_codigo():
    try:
        import zxingcpp
        from PIL import Image, ImageOps
    except Exception as e:
        responder({"listo": False, "error": f"zxing-cpp no disponible: {e}"})
        return
    responder({"listo": True})
    for linea in sys.stdin:
        orden = {}
        try:
            orden = json.loads(linea)
            imagen = ImageOps.exif_transpose(Image.open(orden["entrada"])).convert("RGB")
            codigos = []
            # Se prueba la foto tal cual, en gris y rotada (fotos de celular de lado)
            for variante in (imagen, ImageOps.grayscale(imagen), imagen.rotate(90, expand=True)):
                for r in zxingcpp.read_barcodes(variante):
                    if r.text and r.text not in codigos:
                        codigos.append(r.text)
                if codigos:
                    break
            responder({"id": orden.get("id"), "ok": True, "codigos": codigos})
        except Exception as e:
            responder({"id": orden.get("id"), "ok": False, "error": str(e), "codigos": []})


if __name__ == "__main__":
    {"fondo": modo_fondo, "codigo": modo_codigo}[sys.argv[1]]()
