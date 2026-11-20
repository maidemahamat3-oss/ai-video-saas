"""Télécharge les assets réalistes du jeu depuis Poly Haven (licence CC0) et three.js.

- ciels HDRI convertis en JPG équirectangulaires (fond + éclairage)
- textures PBR (couleur, relief, rugosité) réduites pour le web
- modèles 3D glTF (fusil de précision, caisses, barils, lampadaires…)
- soldat animé (Soldier.glb, exemples three.js)

Usage : python3 game/tools/fetch_assets.py   (écrit dans game/assets/)
"""
import io
import json
import os
import struct
import urllib.request

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..", "assets")
API = "https://api.polyhaven.com/files/"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "operation-eclipse-asset-fetcher/1.0"})
    return urllib.request.urlopen(req, timeout=120).read()


def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "wb").write(data)


def read_hdr(data):
    """Décodeur Radiance RGBE (.hdr) minimal."""
    i = data.index(b"\n\n") + 2
    j = data.index(b"\n", i)
    dims = data[i:j].split()
    h, w = int(dims[1]), int(dims[3])
    pos = j + 1
    img = np.zeros((h, w, 4), dtype=np.uint8)
    for y in range(h):
        if data[pos] == 2 and data[pos + 1] == 2:
            pos += 4
            for c in range(4):
                x = 0
                while x < w:
                    n = data[pos]; pos += 1
                    if n > 128:
                        n -= 128
                        img[y, x:x + n, c] = data[pos]; pos += 1
                    else:
                        img[y, x:x + n, c] = np.frombuffer(data[pos:pos + n], dtype=np.uint8); pos += n
                    x += n
        else:
            img[y] = np.frombuffer(data[pos:pos + w * 4], dtype=np.uint8).reshape(w, 4); pos += w * 4
    e = img[..., 3].astype(np.int32)
    f = np.where(e > 0, np.ldexp(1.0, e - 136), 0.0)
    return img[..., :3].astype(np.float32) * f[..., None]


def hdri(name, exposure):
    out = os.path.join(ROOT, "sky", name + ".jpg")
    if os.path.exists(out):
        return
    info = json.loads(get(API + name))
    rgb = read_hdr(get(info["hdri"]["2k"]["hdr"]["url"])) * exposure
    rgb = rgb / (1 + rgb)  # Reinhard
    rgb = np.clip(rgb, 0, 1) ** (1 / 2.2)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    Image.fromarray((rgb * 255).astype(np.uint8)).save(out, quality=88)
    print("ciel", name)


def texture(name, size):
    info = json.loads(get(API + name))
    for kind, key in (("diff", "Diffuse"), ("nor", "nor_gl"), ("rough", "Rough")):
        out = os.path.join(ROOT, "tex", f"{name}_{kind}.jpg")
        if os.path.exists(out):
            continue
        entry = info.get(key) or info.get(kind)
        url = entry["1k"]["jpg"]["url"] if "jpg" in entry["1k"] else entry["1k"]["png"]["url"]
        im = Image.open(io.BytesIO(get(url))).convert("RGB").resize((size, size), Image.LANCZOS)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        im.save(out, quality=82)
    print("texture", name)


def model(name, tex_size):
    d = os.path.join(ROOT, "models", name)
    if os.path.exists(os.path.join(d, name + ".gltf")):
        return
    g = json.loads(get(API + name))["gltf"]["1k"]["gltf"]
    save(os.path.join(d, name + ".gltf"), get(g["url"]))
    for rel, inc in g["include"].items():
        data = get(inc["url"])
        if rel.endswith(".jpg") and tex_size < 1024:
            im = Image.open(io.BytesIO(data)).convert("RGB").resize((tex_size, tex_size), Image.LANCZOS)
            b = io.BytesIO(); im.save(b, "JPEG", quality=82); data = b.getvalue()
        save(os.path.join(d, rel), data)
    print("modèle", name)


if __name__ == "__main__":
    for name, exp in (("kloppenheim_02", 2.2), ("satara_night", 1.6), ("aarfontein_dawn", 0.9), ("shanghai_bund", 1.0)):
        hdri(name, exp)
    for name, size in (("coast_sand_01", 1024), ("concrete_floor_01", 1024), ("brushed_concrete", 512), ("asphalt_02", 1024),
                       ("corrugated_iron_02", 512), ("metal_plate", 512), ("floor_tiles_06", 512), ("aerial_rocks_02", 1024),
                       ("grey_plaster_02", 512)):
        texture(name, size)
    for name, size in (("bolt_action_rifle_7_62", 1024), ("wooden_military_crate", 512), ("Barrel_01", 512),
                       ("metal_jerrycan", 512), ("concrete_road_barrier", 512), ("street_lamp_01", 512), ("ammo_box", 512),
                       ("propane_tank", 512), ("old_tyre", 512)):
        model(name, size)
    sol = os.path.join(ROOT, "models", "Soldier.glb")
    if not os.path.exists(sol):
        save(sol, get("https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb"))
        print("soldat")
    print("assets prêts")
