#!/usr/bin/env bash
# Re-run the full ingestion pipeline for the WhatsApp "Security LLM" content drop.
#
# Inputs:
#   raw/url-manifest.tsv   (idx|date|url, one entry per line)
#   raw/whatsapp-chat.txt  (original WhatsApp export, reference)
#
# Outputs:
#   videos/{idx}.mp4
#   thumbnails/{idx}.jpg
#   raw/{idx}.info.json + {idx}.description
#   transcripts/{idx}.txt       (whisper.cpp)
#   frames/{idx}/*.jpg          (ffmpeg scene-change + 0.5fps sampling)
#   ocr/{idx}.txt               (tesseract per frame)
#
# Tools required:
#   yt-dlp, gallery-dl, ffmpeg, tesseract, whisper-cli (whisper.cpp), python3
#
# Whisper model:
#   ~/.cache/whisper-models/ggml-base.bin
#   curl -L -o ~/.cache/whisper-models/ggml-base.bin \
#     https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

WHISPER_MODEL="${WHISPER_MODEL:-$HOME/.cache/whisper-models/ggml-base.bin}"

mkdir -p videos thumbnails transcripts frames ocr captions raw

# 1. Download videos + metadata
while IFS='|' read -r idx date url; do
  [[ -z "${idx:-}" || "${idx}" =~ ^# ]] && continue
  out="videos/${idx}.mp4"
  if [[ -f "$out" ]]; then
    echo "skip download ${idx} (exists)"; continue
  fi
  echo "==> download ${idx} ${url}"
  yt-dlp --write-info-json --write-description --write-thumbnail --no-warnings \
    -o "videos/${idx}.%(ext)s" "$url" || echo "  (download failed — likely login-walled)"
  # Move sidecars to raw/, thumbnail to thumbnails/
  [[ -f "videos/${idx}.info.json" ]]   && mv "videos/${idx}.info.json"   raw/
  [[ -f "videos/${idx}.description" ]] && mv "videos/${idx}.description" raw/
  [[ -f "videos/${idx}.jpg" ]]         && mv "videos/${idx}.jpg"         thumbnails/
done < raw/url-manifest.tsv

# 2. Captions from info.json
for j in raw/*.info.json; do
  idx="$(basename "$j" .info.json)"
  python3 - "$j" > "captions/${idx}.txt" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
print('TITLE:', d.get('title') or '')
print('UPLOADER:', d.get('uploader_id') or d.get('uploader') or '')
print('TIMESTAMP:', d.get('timestamp') or '')
print('DURATION:', d.get('duration') or '')
print('---DESCRIPTION---')
print(d.get('description') or '')
PY
done

# 3. Transcribe with whisper.cpp
for mp4 in videos/*.mp4; do
  idx="$(basename "$mp4" .mp4)"
  out="transcripts/${idx}.txt"
  [[ -f "$out" ]] && continue
  echo "==> transcribe ${idx}"
  wav="transcripts/${idx}.wav"
  ffmpeg -v error -y -i "$mp4" -ar 16000 -ac 1 -c:a pcm_s16le "$wav"
  whisper-cli -m "$WHISPER_MODEL" -f "$wav" -otxt -of "transcripts/${idx}"
  rm -f "$wav"
done

# 4. Keyframes (scene-change, fallback to 0.5fps)
for mp4 in videos/*.mp4; do
  idx="$(basename "$mp4" .mp4)"
  mkdir -p "frames/${idx}"
  [[ -n "$(ls -A "frames/${idx}" 2>/dev/null)" ]] && continue
  ffmpeg -v error -y -i "$mp4" \
    -vf "select='gt(scene,0.35)',scale=1280:-1" -vsync vfr -frames:v 12 \
    "frames/${idx}/scene_%02d.jpg" || true
  cnt=$(ls "frames/${idx}/" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$cnt" -lt 4 ]]; then
    ffmpeg -v error -y -i "$mp4" \
      -vf "fps=1/2,scale=1280:-1" -frames:v 12 \
      "frames/${idx}/time_%02d.jpg" || true
  fi
done

# 5. OCR each frame
for d in frames/*/; do
  idx="$(basename "$d")"
  : > "ocr/${idx}.txt"
  for img in "$d"*.jpg; do
    [[ -f "$img" ]] || continue
    {
      echo "--- $(basename "$img") ---"
      tesseract "$img" - -l eng 2>/dev/null | sed '/^$/d'
    } >> "ocr/${idx}.txt"
  done
done

echo "Done. Per-URL markdown files live one level up in docs/content/."
