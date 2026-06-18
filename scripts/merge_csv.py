#!/usr/bin/env python3
import csv, glob, os, sys
if len(sys.argv) != 3:
    print("Usage: python3 scripts/merge_csv.py <input_dir> <output_csv>"); raise SystemExit(1)
paths = sorted(glob.glob(os.path.join(sys.argv[1], "AIcertainty_*.csv")))
if not paths:
    print("No AIcertainty_*.csv files found."); raise SystemExit(1)
header, rows = None, []
for path in paths:
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f); file_header = next(reader)
        if header is None: header = file_header
        elif file_header != header: raise ValueError(f"Header mismatch: {path}")
        rows.extend(reader)
with open(sys.argv[2], "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f); writer.writerow(header); writer.writerows(rows)
print(f"Merged {len(paths)} files and {len(rows)} rows into {sys.argv[2]}")
