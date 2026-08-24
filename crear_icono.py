# -*- coding: utf-8 -*-
"""Genera el icono de NutriPlan (nutriplan.ico) con los colores de la app.
Logo: cuadrado redondeado verde menta + simbolo (circulo mitad relleno), como en la app.
Uso: python crear_icono.py
"""
import os
from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.abspath(__file__))

MENTA = (95, 208, 166, 255)     # #5fd0a6  acento de la app
OSCURO = (4, 35, 26, 255)       # #04231a  tinta sobre el acento
FONDO = (13, 15, 20, 0)         # transparente

TAMANOS = [256, 128, 64, 48, 32, 16]


def dibujar(size):
    """Dibuja el logo a un tamano dado (con supersampling para suavizar)."""
    ss = 4                      # factor de supersampling
    s = size * ss
    img = Image.new("RGBA", (s, s), FONDO)
    d = ImageDraw.Draw(img)

    # Cuadrado redondeado de fondo (acento menta)
    margen = int(s * 0.06)
    radio = int(s * 0.24)
    d.rounded_rectangle([margen, margen, s - margen, s - margen],
                        radius=radio, fill=MENTA)

    # Simbolo: circulo con la mitad derecha rellena (como el ◑ de la app)
    cx, cy = s / 2, s / 2
    r = s * 0.27
    grosor = max(2, int(s * 0.055))
    caja = [cx - r, cy - r, cx + r, cy + r]

    # Mitad derecha rellena
    d.pieslice(caja, start=-90, end=90, fill=OSCURO)
    # Contorno del circulo completo
    d.ellipse(caja, outline=OSCURO, width=grosor)

    return img.resize((size, size), Image.LANCZOS)


def main():
    capas = [dibujar(t) for t in TAMANOS]
    destino = os.path.join(BASE, "nutriplan.ico")
    # El primero se guarda con el resto como tamanos adicionales
    capas[0].save(destino, format="ICO",
                  sizes=[(t, t) for t in TAMANOS])
    # PNG de cortesia por si hace falta en otro sitio (web, tienda, etc.)
    capas[0].save(os.path.join(BASE, "nutriplan.png"), format="PNG")
    print("Icono creado:", destino)
    print("PNG creado  :", os.path.join(BASE, "nutriplan.png"))


if __name__ == "__main__":
    main()
