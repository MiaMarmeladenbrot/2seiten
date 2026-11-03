"""
Cuts the search model down to the vocabulary German book searches actually use,
and writes it to .cache/search-model-de for upload to the Hugging Face Hub
(MiaMarmeladenbrot/paraphrase-multilingual-MiniLM-L12-v2-de). It stays out of
web/public on purpose: Vercel Hobby traffic is limited, Hugging Face serves it.

paraphrase-multilingual-MiniLM-L12-v2 is 82 % dictionary: 250,002 tokens for
more than 50 languages, 384 numbers each. The twelve transformer layers that do
the actual work are a fraction of that. This script keeps the tokens of

  - every text in data/ (episodes, books, quotes, DNB keywords and blurbs),
  - the 50,000 most frequent German words, lower-case and capitalised,
  - the 20,000 most frequent English words, for anglicisms in queries,
  - every single Latin letter, digit and punctuation mark,

and drops the rest: roughly 29,000 tokens instead of 250,000, ~34 MB instead
of ~135 MB.

Pruning does not change a single kept weight. The tokenizer is a Unigram model
that picks the best-scoring segmentation; removing tokens that were not part of
that segmentation cannot change it. So every text that only needs kept tokens
gets bit-identical vectors, and the precomputed book vectors stay valid. The
script checks this for every text in data/. A query word outside the kept
vocabulary is split into smaller kept pieces, never into an error.

Sources are pinned (model revision, word-list commit) and cached in .cache/.

Usage:
    .venv/bin/pip install onnx numpy tokenizers
    .venv/bin/python scripts/prune_search_model.py
"""

import json
import sys
import unicodedata
import urllib.request
from pathlib import Path

import numpy as np
import onnx
from onnx import numpy_helper
from tokenizers import Tokenizer

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / ".cache" / "search-model"
OUT_DIR = ROOT / ".cache" / "search-model-de"

MODEL_URL = "https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2/resolve/2c4055b12046f11709e9df2c122e59ffbdc2f900/"
MODEL_FILES = ["config.json", "tokenizer.json", "tokenizer_config.json", "onnx/model_quantized.onnx"]
WORDS_URL = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/525f9b560de45753a5ea01069454e72e9aa541c6/content/2018/"
GERMAN_WORDS = 50_000
ENGLISH_WORDS = 20_000

EMBEDDING = "embeddings.word_embeddings.weight_quantized"
METASPACE = "▁"


def fetch(url, target):
    if not target.exists():
        print(f"  lade {url}")
        target.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(url, target)
    return target


def project_texts():
    texts = []
    books = json.loads((ROOT / "data" / "books.json").read_text())
    for ep in books["episodes"]:
        texts += [ep["title"], ep["topic"]]
        for book in ep["books"]:
            texts += [book["title"], book["author"], book.get("quote") or ""]
    for ep in json.loads((ROOT / "data" / "episodes.json").read_text()):
        texts += [ep.get("title", ""), ep.get("description", ""), ep.get("description_full_text", "")]
    details = json.loads((ROOT / "data" / "book_details.json").read_text())["books"]
    for detail in details.values():
        texts += detail.get("keywords", []) + detail.get("genre", [])
        texts += [entry["label"] for entry in detail.get("thema", [])]
        texts += [detail.get("blurb") or "", detail.get("subtitle") or ""]
    return [t for t in texts if t]


def frequent_words(language, count):
    path = fetch(f"{WORDS_URL}{language}/{language}_50k.txt", CACHE_DIR / f"{language}_50k.txt")
    words = [line.split()[0] for line in path.read_text(encoding="utf-8").splitlines()[:count]]
    return words + [w[:1].upper() + w[1:] for w in words]


def is_latin_character(piece):
    char = piece.replace(METASPACE, "")
    if piece == METASPACE:
        return True
    if len(char) != 1:
        return False
    if char.isascii() and char.isdigit():
        return True
    return "LATIN" in unicodedata.name(char, "") or unicodedata.category(char)[0] in "PSZ"


def token_ids(tokenizer, texts):
    ids = set()
    for encoding in tokenizer.encode_batch(texts, add_special_tokens=False):
        ids.update(encoding.ids)
    return ids


def main():
    print("Quellen:")
    for name in MODEL_FILES:
        fetch(MODEL_URL + name, CACHE_DIR / name)

    tokenizer_json = json.loads((CACHE_DIR / "tokenizer.json").read_text())
    tokenizer = Tokenizer.from_str(json.dumps(tokenizer_json))
    tokenizer.no_truncation()
    vocab = tokenizer_json["model"]["vocab"]
    specials = {token["id"] for token in tokenizer_json["added_tokens"]}

    texts = project_texts()
    keep = (
        specials
        | token_ids(tokenizer, texts)
        | token_ids(tokenizer, frequent_words("de", GERMAN_WORDS))
        | token_ids(tokenizer, frequent_words("en", ENGLISH_WORDS))
        | {i for i, (piece, _) in enumerate(vocab) if is_latin_character(piece)}
    )
    kept = sorted(keep)
    new_id = {old: new for new, old in enumerate(kept)}
    print(f"\nBehalten: {len(kept)} von {len(vocab)} Tokens")

    pruned_json = json.loads(json.dumps(tokenizer_json))
    pruned_json["model"]["vocab"] = [vocab[i] for i in kept]
    pruned_json["model"]["unk_id"] = new_id[tokenizer_json["model"]["unk_id"]]
    for token in pruned_json["added_tokens"]:
        token["id"] = new_id[token["id"]]
    for special in pruned_json["post_processor"]["special_tokens"].values():
        special["ids"] = [new_id[i] for i in special["ids"]]
    pruned = Tokenizer.from_str(json.dumps(pruned_json))
    pruned.no_truncation()

    changed = 0
    for before, after in zip(tokenizer.encode_batch(texts), pruned.encode_batch(texts)):
        if [new_id.get(i) for i in before.ids] != after.ids:
            changed += 1
    if changed:
        print(f"FEHLER: {changed} von {len(texts)} Projekttexten werden anders zerlegt")
        return 1
    print(f"Geprüft: alle {len(texts)} Projekttexte werden identisch zerlegt")

    model = onnx.load(CACHE_DIR / "onnx" / "model_quantized.onnx")
    embedding = next(init for init in model.graph.initializer if init.name == EMBEDDING)
    rows = numpy_helper.to_array(embedding)[np.array(kept)]
    embedding.CopyFrom(numpy_helper.from_array(rows, EMBEDDING))

    config = json.loads((CACHE_DIR / "config.json").read_text())
    config["vocab_size"] = len(kept)

    (OUT_DIR / "onnx").mkdir(parents=True, exist_ok=True)
    onnx.save(model, OUT_DIR / "onnx" / "model_quantized.onnx")
    (OUT_DIR / "tokenizer.json").write_text(json.dumps(pruned_json, ensure_ascii=False))
    (OUT_DIR / "config.json").write_text(json.dumps(config, indent=2) + "\n")
    (OUT_DIR / "tokenizer_config.json").write_bytes((CACHE_DIR / "tokenizer_config.json").read_bytes())

    print(f"\nGeschrieben: {OUT_DIR}")
    for path in sorted(OUT_DIR.rglob("*.*")):
        print(f"  {path.relative_to(OUT_DIR)}: {path.stat().st_size / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
