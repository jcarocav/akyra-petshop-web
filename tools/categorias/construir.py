#!/usr/bin/env python
"""Fotos de las categorías del inicio: baja las fotos de Pexels (tools/categorias/fuentes.json), les quita el fondo
con rembg (gratis, corre en el PC) y deja un WebP transparente (< 40 KB) en assets/img/categorias/<id>.webp.

Requisitos (una vez):  pip install "rembg[cpu]" pillow opencv-python-headless numpy
Uso:                   python tools/categorias/construir.py
"""
import io, json, os, sys, urllib.request
import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
ORIG = os.path.join(RAIZ, '.tmp', 'categorias', 'orig')
SALIDA = os.path.join(RAIZ, 'assets', 'img', 'categorias')
CAJA = (300, 260)          # máximo ancho × alto (px): se ven a ~82 px de alto, con margen para pantallas de alta densidad
MAX_BYTES = 40 * 1024
os.makedirs(ORIG, exist_ok=True)
os.makedirs(SALIDA, exist_ok=True)
fuentes = json.load(open(os.path.join(RAIZ, 'tools', 'categorias', 'fuentes.json'), encoding='utf-8'))['fotos']
sesion = new_session('birefnet-general-lite')


def bajar(f):
    ruta = os.path.join(ORIG, f"{f['id']}.jpg")
    if not os.path.exists(ruta):
        u = f"https://images.pexels.com/photos/{f['pexels']}/pexels-photo-{f['pexels']}.jpeg?auto=compress&cs=tinysrgb&w=1400"
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        open(ruta, 'wb').write(urllib.request.urlopen(req, timeout=60).read())
    return ruta


def alfa_de(img):
    return np.array(remove(img, session=sesion).getchannel('A'))


def arena(ruta, img):
    """El gato saliendo del arenero: rembg deja el arenero como fondo, así que se recupera con GrabCut dentro de su caja."""
    cv = cv2.imread(ruta)
    h, w = cv.shape[:2]
    gato = alfa_de(img)
    mask = np.full((h, w), cv2.GC_BGD, np.uint8)
    mask[1250:1700, 470:1400] = cv2.GC_PR_BGD
    mask[1300:1650, 500:1398] = cv2.GC_PR_FGD
    mask[gato > 200] = cv2.GC_FGD
    bg = np.zeros((1, 65), np.float64)
    fg = np.zeros((1, 65), np.float64)
    cv2.grabCut(cv, mask, None, bg, fg, 8, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    caja = np.zeros((h, w), np.uint8)
    caja[1270:1668, 540:1400] = 255          # solo el arenero (sin piso ni zócalo a la izquierda)
    m = cv2.bitwise_and(m, caja)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    m = cv2.GaussianBlur(m, (5, 5), 0)
    return np.maximum(m, gato)


def salud(img):
    """Perro con collar isabelino: se une el recorte del cuerpo (birefnet) con el del cono (isnet)."""
    otro = np.array(remove(img, session=new_session('isnet-general-use')).getchannel('A'))
    return np.maximum(alfa_de(img), otro)


def guardar(img_rgba, destino):
    a = np.array(img_rgba.getchannel('A')).astype(np.float32)
    a = np.clip((a - 28) * 1.12, 0, 255)                      # fuera sombras y bordes grisáceos
    a = cv2.GaussianBlur(a, (3, 3), 0)
    a = np.where(a < 12, 0, a).astype(np.uint8)
    img_rgba.putalpha(Image.fromarray(a))
    bb = img_rgba.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    img = img_rgba.crop(bb)
    img.thumbnail(CAJA, Image.LANCZOS)
    for calidad in (84, 78, 72, 66, 60, 54):
        buf = io.BytesIO()
        img.save(buf, 'WEBP', quality=calidad, method=6, alpha_quality=92)
        if buf.tell() <= MAX_BYTES:
            break
    open(destino, 'wb').write(buf.getvalue())
    return img.size, buf.tell()


for f in fuentes:
    ruta = bajar(f)
    img = Image.open(ruta).convert('RGB')
    if f.get('especial') == 'arena':
        alfa = arena(ruta, img)
    elif f.get('especial') == 'salud':
        alfa = salud(img)
    else:
        alfa = alfa_de(img)
    rgba = img.convert('RGBA')
    rgba.putalpha(Image.fromarray(alfa))
    tam, peso = guardar(rgba, os.path.join(SALIDA, f"{f['id']}.webp"))
    print(f"{f['id']}: {tam[0]}×{tam[1]} · {peso / 1024:.1f} KB", flush=True)
