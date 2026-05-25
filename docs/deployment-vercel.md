# Deploy na Vercel

## Projeto unificado

O app de produção está em [`apps/instrument`](../apps/instrument). Uma única página: câmera + MediaPipe (browser) + mapeamento + Tone.js.

## Pré-requisitos

1. Modelo em `apps/instrument/public/models/gesture_recognizer.task` (ver `public/models/README.md`).
2. Config em `apps/instrument/public/config/default-instrument.yaml`.

## Build local

```bash
npm install
npm run build
```

## Vercel

- **Root Directory:** repositório (raiz)
- **Build Command:** `npm install && npm run build` (usa `vercel.json`)
- **Output:** `apps/instrument/dist`

Domínio customizado: HTTPS obrigatório para `getUserMedia`.

## Modos de URL

| Query | Uso |
|-------|-----|
| (padrão) | Browser — câmera no cliente |
| `?backend=ws` | Dev — Python `hand-gestures --musical` + WS :8765 |
| `?demo=1` | Replay de `public/fixtures/demo.ndjson` (opcional) |

## Portfólio (iframe)

No site pessoal:

```html
<iframe
  src="https://instrument.seudominio.com/"
  allow="camera"
  style="width:100%;min-height:600px;border:0"
  title="Hand Gestures Instrument"
></iframe>
```

Ou link direto. O app envia `postMessage({ type: 'instrument.ready' })` ao pai após iniciar.

## Dev Python (opcional)

```bash
hand-gestures --musical --pick-camera
# mini-app com ?backend=ws
```
