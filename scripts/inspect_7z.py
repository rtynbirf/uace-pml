#!/usr/bin/env python3
"""Inspect and extract the POLYMAT 7z archive."""
import py7zr
import os

SRC = "/home/z/my-project/upload/...ПОЛИМАТ.7z"
DST = "/home/z/my-project/upload/_polymat_7z"

os.makedirs(DST, exist_ok=True)

with py7zr.SevenZipFile(SRC, mode="r") as z:
    print("=== ARCHIVE INFO ===")
    print("Entries:")
    for info in z.list():
        kind = "DIR " if info.is_directory else "FILE"
        print(f"  {kind}  {info.filename}  size={info.uncompressed}  compressed={info.compressed}")
    print("\n=== EXTRACTING ===")
    z.extractall(path=DST)

print("\n=== EXTRACTED TREE ===")
for root, dirs, files in os.walk(DST):
    rel = os.path.relpath(root, DST)
    for f in files:
        p = os.path.join(root, f)
        print(f"  {rel}/{f}  {os.path.getsize(p)} bytes")
