#!/usr/bin/env python3
"""Gộp dữ liệu -> data.js
  vocab/*.jsonl    từ vựng Mimi Kara Oboeru N2 (1160 từ)
  grammar/*.jsonl  ngữ pháp Shinkanzen N2 + 110 mẫu N3 (đánh số lại liên tục theo thứ tự file)
  past/*.jsonl     đề thật + đề thi thử, phần 言語知識 (問題1–9)
  reading/*.jsonl  đọc hiểu (問題10–14)
Chạy: python3 build_data.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent


def read_dir(name):
    rows = []
    for f in sorted((ROOT / name).glob('*.jsonl')):
        rows += [json.loads(l) for l in f.read_text(encoding='utf-8').splitlines() if l.strip()]
    return rows


vocab = sorted(read_dir('vocab'), key=lambda w: w['no'])
nos = [w['no'] for w in vocab]
if len(nos) != len(set(nos)):
    raise SystemExit('Từ vựng bị trùng số')

grammar = []
for lv in ('n2', 'n3'):
    rows = []
    for f in sorted((ROOT / 'grammar').glob(f'{lv}_*.jsonl')):
        part = [json.loads(l) for l in f.read_text(encoding='utf-8').splitlines() if l.strip()]
        rows += sorted(part, key=lambda g: g['no'])
    if lv == 'n3':
        rows.sort(key=lambda g: g['no'])
    for i, g in enumerate(rows, 1):
        g['no'] = i
    grammar += rows

past = read_dir('past')
reading = read_dir('reading')

with open(ROOT / 'data.js', 'w', encoding='utf-8') as f:
    f.write('// File sinh tự động bởi build_data.py — đừng sửa tay\n')
    for name, val in (('VOCAB', vocab), ('GRAMMAR', grammar), ('PAST', past), ('READING', reading)):
        f.write(f'const {name} = ' + json.dumps(val, ensure_ascii=False, separators=(',', ':')) + ';\n')

print(f'Từ vựng: {len(vocab)} từ, {sum(len(w["ex"]) for w in vocab)} câu ví dụ')
print(f'Ngữ pháp: N2 {sum(g["lv"] == "N2" for g in grammar)} mẫu, N3 {sum(g["lv"] == "N3" for g in grammar)} mẫu')
exams = sorted({q['exam'] for q in past})
print(f'Đề 言語知識: {len(past)} câu từ {len(exams)} đề')
print(f'Đọc hiểu: {len(reading)} bài, {sum(len(r["qs"]) for r in reading)} câu')
