# Hand Gestures — Instrument (Vercel)

App unificado: câmera + MediaPipe (browser) + mapeamento + Tone.js.

## Desenvolvimento

```bash
# Na raiz do monorepo
npm install
python scripts/download_model.py
copy models\gesture_recognizer.task public\models\

npm run dev
```

http://localhost:5173

## Modos

- **Padrão:** pipeline no browser
- **`?backend=ws`:** WebSocket para `hand-gestures --musical` local
- **`?demo=1`:** replay NDJSON (opcional em `public/fixtures/`)

## Build

```bash
npm run build
```

Deploy: ver [docs/deployment-vercel.md](../../docs/deployment-vercel.md).
