#!/usr/bin/env python3
# ============================================================================
# LEEWAY HEADER — DO NOT REMOVE
# PROFILE: LEEWAY-ORDER
# TAG: TOOLS.PYTHON.MODELS.DOWNLOADER
# REGION: 🟣 MCP
# VERSION: 2.2.0
# ============================================================================
# Agentic OS — Leeway Python Model Downloader (Exact Core Set)
#
# Purpose:
# - Downloads the EXACT 5 repos you specified:
#     1) onnx-community/Qwen2.5-0.5B-Instruct        (QWEN core chat)
#     2) HuggingFaceTB/SmolLM-135M-Instruct         (VISION core)
#     3) Xenova/all-MiniLM-L6-v2                    (ORIGINAL embed core)
#     4) onnx-community/stable-diffusion-v1-5       (IMG_GEN)
#     5) Xenova/vit-tiny-patch16-224                (backup vision)
# - Writes into <repo-root>/public/models/<org>_<model>
# - Uses huggingface_hub.snapshot_download with allow_patterns
# - Avoids pulling entire repos by default, but uses recursive patterns where
#   repo layouts are nested (especially diffusion + onnx-community)
#
# Auth:
# - Requires HF_TOKEN env var OR `huggingface-cli login`
#
# DISCOVERY_PIPELINE:
#   Voice → Intent → Location → Vertical → Ranking → Render
# ============================================================================

import os
import traceback
from typing import List, Dict
from huggingface_hub import snapshot_download

BASE_DIR = os.path.abspath(os.path.join(os.getcwd(), "public", "models"))

# ------------------------------------------------------------------
# EXACT model set (as provided by you)
# ------------------------------------------------------------------
MODELS: List[Dict] = [
    {
        "repo": "onnx-community/Qwen2.5-0.5B-Instruct",
        "name": "Qwen2.5-0.5B-Instruct (QWEN core chat)",
        # ONNX-community repos often keep ONNX under onnx/; be inclusive but not huge
        "allow": [
            "onnx/*.onnx",
            "config.json",
            "generation_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json",
            "merges.txt",
            "special_tokens_map.json",
        ],
        "verify": {"need_onnx": True, "need_config": True, "need_tokenizer": True},
    },
    {
        "repo": "HuggingFaceTB/SmolLM-135M-Instruct",
        "name": "SmolLM-135M-Instruct (VISION core)",
        # Many HF repos keep ONNX artifacts under onnx/ when present; include both root and onnx/
        "allow": [
            "onnx/*.onnx",
            "*.onnx",
            "config.json",
            "generation_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json",
            "merges.txt",
            "special_tokens_map.json",
        ],
        "verify": {"need_onnx": True, "need_config": True, "need_tokenizer": True},
    },
    {
        "repo": "Xenova/all-MiniLM-L6-v2",
        "name": "all-MiniLM-L6-v2 (ORIGINAL embed core)",
        # Xenova packs can be ONNX or other formats depending on model; include common assets
        "allow": [
            "**/*.onnx",
            "**/*.bin",
            "**/*.json",
            "**/*.txt",
        ],
        # embeddings model should have config + tokenizer; ONNX may exist depending on pack
        "verify": {"need_onnx": False, "need_config": True, "need_tokenizer": True},
    },
    {
        "repo": "onnx-community/stable-diffusion-v1-5",
        "name": "Stable Diffusion v1.5 (IMG_GEN)",
        # Critical: diffusion repos usually have nested folders -> use recursive patterns
        "allow": [
            "**/*.onnx",
            "**/*.json",
            "**/*.txt",
        ],
        "verify": {"need_onnx": True, "need_config": False, "need_tokenizer": False},
    },
    {
        "repo": "Xenova/vit-tiny-patch16-224",
        "name": "ViT Tiny 224 (backup vision)",
        "allow": [
            "**/*.onnx",
            "**/*.bin",
            "config.json",
            "preprocessor_config.json",
            "tokenizer.json",
            "special_tokens_map.json",
            "**/*.json",
        ],
        "verify": {"need_onnx": True, "need_config": True, "need_tokenizer": False},
    },
]


def safe_folder(repo_id: str) -> str:
    return repo_id.replace("/", "_")


def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)


def walk_files(root_dir: str):
    for r, _, files in os.walk(root_dir):
        for f in files:
            yield r, f


def has_any_ext(root_dir: str, ext: str) -> bool:
    ext = ext.lower()
    return any(f.lower().endswith(ext) for _, f in walk_files(root_dir))


def has_named(root_dir: str, names) -> bool:
    names = set(names)
    return any(f in names for _, f in walk_files(root_dir))


def folder_size_mb(root_dir: str) -> float:
    total = 0
    for r, f in walk_files(root_dir):
        try:
            total += os.path.getsize(os.path.join(r, f))
        except Exception:
            pass
    return round(total / (1024 * 1024), 1)


def auth_hint() -> str:
    return "If failures show 401/403: run `huggingface-cli login` or set HF_TOKEN."


if __name__ == "__main__":
    print("Leeway Python model downloader (Exact Core Set)")
    print("Base dir:", BASE_DIR)
    ensure_dir(BASE_DIR)

    total = 0.0
    failures = []

    for m in MODELS:
        repo = m["repo"]
        name = m["name"]
        allow = m.get("allow", [])
        folder = safe_folder(repo)
        out = os.path.join(BASE_DIR, folder)

        print()
        print(f"📥 {name}")
        print(f"   Repo : {repo}")
        print(f"   Out  : {out}")

        try:
            ensure_dir(out)
            print("   snapshot_download: starting...")

            # use_auth_token=True will use HF_TOKEN if present or cached login token
            snapshot_download(
                repo_id=repo,
                local_dir=out,
                allow_patterns=allow,
                use_auth_token=True,
                local_dir_use_symlinks=False,  # more Windows-friendly + clearer copies
            )

            mb = folder_size_mb(out)
            total += mb

            # Verification (lightweight + correct for each repo type)
            v = m.get("verify", {})
            need_onnx = bool(v.get("need_onnx", True))
            need_config = bool(v.get("need_config", True))
            need_tokenizer = bool(v.get("need_tokenizer", True))

            has_onnx = has_any_ext(out, ".onnx")
            has_cfg = has_named(out, ["config.json"])
            has_tok = has_named(
                out,
                [
                    "tokenizer.json",
                    "tokenizer_config.json",
                    "vocab.json",
                    "merges.txt",
                    "special_tokens_map.json",
                ],
            )

            print(f"   Size: {mb} MB    ONNX={has_onnx} CFG={has_cfg} TOK={has_tok}")

            ok = True
            if need_onnx and not has_onnx:
                ok = False
            if need_config and not has_cfg:
                ok = False
            if need_tokenizer and not has_tok:
                ok = False

            if not ok:
                failures.append((name, repo, "Missing required files after download (check allow_patterns)."))

        except Exception as e:
            print("   FAILED:", e)
            traceback.print_exc()
            failures.append((name, repo, str(e)))

    print()
    print(f"DONE. Total downloaded: {round(total, 1)} MB")

    if failures:
        print("\nSome models failed:")
        for f in failures:
            print(f" - {f[0]} ({f[1]}) : {f[2]}")
        print(auth_hint())
    else:
        print("All models downloaded successfully.")
