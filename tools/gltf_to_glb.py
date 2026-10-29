"""Pack Quaternius .gltf characters (buffers and images embedded as data: URIs) into compact .glb files.

Run: python tools/gltf_to_glb.py
Reads assets_src/quaternius/<Name>.gltf and writes web/models/<Name>.glb, which build_web.py bundles into the apps.
The character view (Góc nhìn nhân vật 3D) loads them by name; any missing file falls back to the built-in figure.
"""
import base64
import glob
import json
import os
import struct
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'assets_src', 'quaternius')
OUT = os.path.join(ROOT, 'web', 'models')


def data_uri(uri):
    if not uri.startswith('data:'):
        sys.exit('external file reference not supported: ' + uri[:60])
    head, payload = uri.split(',', 1)
    mime = head[5:].split(';')[0]
    return mime, base64.b64decode(payload) if ';base64' in head else payload.encode()


def pack(path):
    gltf = json.load(open(path, encoding='utf-8'))
    blob = bytearray()
    starts = []
    for buf in gltf.get('buffers', []):
        _, data = data_uri(buf['uri'])
        while len(blob) % 4:
            blob.append(0)
        starts.append(len(blob))
        blob += data
    for view in gltf.get('bufferViews', []):
        view['byteOffset'] = view.get('byteOffset', 0) + starts[view.get('buffer', 0)]
        view['buffer'] = 0
    for img in gltf.get('images', []):
        if 'uri' in img:
            mime, data = data_uri(img.pop('uri'))
            while len(blob) % 4:
                blob.append(0)
            gltf.setdefault('bufferViews', []).append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data)})
            img['bufferView'] = len(gltf['bufferViews']) - 1
            img['mimeType'] = mime
            blob += data
    while len(blob) % 4:
        blob.append(0)
    gltf['buffers'] = [{'byteLength': len(blob)}]
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(blob)
    return (struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(js), b'JSON') + js
            + struct.pack('<I4s', len(blob), b'BIN\0') + bytes(blob))


def main():
    files = sorted(glob.glob(os.path.join(SRC, '*.gltf')))
    if not files:
        sys.exit('no .gltf files in ' + SRC)
    os.makedirs(OUT, exist_ok=True)
    for f in files:
        name = os.path.splitext(os.path.basename(f))[0]
        glb = pack(f)
        open(os.path.join(OUT, name + '.glb'), 'wb').write(glb)
        print(f'{name}: {os.path.getsize(f) // 1024} KB -> {len(glb) // 1024} KB')


if __name__ == '__main__':
    main()
