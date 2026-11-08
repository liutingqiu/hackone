# -*- coding: utf-8 -*-
"""色彩数学：sRGB -> Lab(D65)、CIEDE2000、HEX 处理。构建与校验脚本共用。"""
import math


def hex_to_rgb(h):
    h = h.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        raise ValueError("bad hex: " + h)
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def rgb_to_hex(rgb):
    return "#" + "".join(f"{max(0, min(255, int(round(v)))):02X}" for v in rgb)


def norm_hex(h):
    return rgb_to_hex(hex_to_rgb(h))


def _lin(v):
    v = v / 255.0
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def srgb_to_lab(rgb):
    r, g, b = (_lin(v) for v in rgb)
    X = r * 0.4124564 + g * 0.3575761 + b * 0.1804375
    Y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750
    Z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041
    xn, yn, zn = 0.95047, 1.0, 1.08883

    def f(t):
        return t ** (1.0 / 3.0) if t > 0.008856 else (903.3 * t + 16) / 116.0

    fx, fy, fz = f(X / xn), f(Y / yn), f(Z / zn)
    return [116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz)]


def delta_e00(lab1, lab2):
    """CIEDE2000（kL=kC=kH=1）。"""
    L1, a1, b1 = lab1
    L2, a2, b2 = lab2
    C1 = math.hypot(a1, b1)
    C2 = math.hypot(a2, b2)
    Cbar = (C1 + C2) / 2.0
    Cbar7 = Cbar ** 7
    G = 0.5 * (1 - math.sqrt(Cbar7 / (Cbar7 + 25.0 ** 7)))

    a1p = (1 + G) * a1
    a2p = (1 + G) * a2
    C1p = math.hypot(a1p, b1)
    C2p = math.hypot(a2p, b2)

    def hue(b_, ap):
        if b_ == 0 and ap == 0:
            return 0.0
        h = math.degrees(math.atan2(b_, ap))
        return h + 360.0 if h < 0 else h

    h1p = hue(b1, a1p)
    h2p = hue(b2, a2p)

    dLp = L2 - L1
    dCp = C2p - C1p

    if C1p * C2p == 0:
        dhp = 0.0
    elif abs(h2p - h1p) <= 180:
        dhp = h2p - h1p
    elif h2p - h1p > 180:
        dhp = h2p - h1p - 360
    else:
        dhp = h2p - h1p + 360
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2.0))

    Lbarp = (L1 + L2) / 2.0
    Cbarp = (C1p + C2p) / 2.0
    if C1p * C2p == 0:
        hbarp = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hbarp = (h1p + h2p) / 2.0
    elif h1p + h2p < 360:
        hbarp = (h1p + h2p + 360) / 2.0
    else:
        hbarp = (h1p + h2p - 360) / 2.0

    T = (1
         - 0.17 * math.cos(math.radians(hbarp - 30))
         + 0.24 * math.cos(math.radians(2 * hbarp))
         + 0.32 * math.cos(math.radians(3 * hbarp + 6))
         - 0.20 * math.cos(math.radians(4 * hbarp - 63)))

    dTheta = 30 * math.exp(-(((hbarp - 275) / 25.0) ** 2))
    Cbarp7 = Cbarp ** 7
    RC = 2 * math.sqrt(Cbarp7 / (Cbarp7 + 25.0 ** 7))
    SL = 1 + (0.015 * (Lbarp - 50) ** 2) / math.sqrt(20 + (Lbarp - 50) ** 2)
    SC = 1 + 0.045 * Cbarp
    SH = 1 + 0.015 * Cbarp * T
    RT = -math.sin(math.radians(2 * dTheta)) * RC

    t1 = dLp / SL
    t2 = dCp / SC
    t3 = dHp / SH
    return math.sqrt(t1 * t1 + t2 * t2 + t3 * t3 + RT * t2 * t3)


def de_hex(h1, h2):
    return delta_e00(srgb_to_lab(hex_to_rgb(h1)), srgb_to_lab(hex_to_rgb(h2)))


def norm_code(c):
    """色号归一化：A01 / A1 / a-01 都算 A1，便于跨数据源比对。"""
    c = (c or "").strip().upper().replace("-", "").replace("_", "").replace(" ", "")
    out = []
    i = 0
    while i < len(c):
        if c[i].isdigit():
            j = i
            while j < len(c) and c[j].isdigit():
                j += 1
            out.append(str(int(c[i:j])))
            i = j
        else:
            out.append(c[i])
            i += 1
    return "".join(out)
