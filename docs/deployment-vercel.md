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

### Opção A (recomendada) — raiz do repositório

| Campo | Valor |
|-------|--------|
| **Root Directory** | *(vazio / `.`)* |
| **Build Command** | `npm run build` (ou o de [`vercel.json`](../vercel.json)) |
| **Output Directory** | `apps/instrument/dist` |
| **Install Command** | `npm install` |

O [`vercel.json`](../vercel.json) na raiz do repo já define isto.

### Opção B — Root Directory = `apps/instrument`

Se no dashboard a raiz for `apps/instrument` (como no preset Vite), use o [`apps/instrument/vercel.json`](../apps/instrument/vercel.json):

- **Install:** `cd ../.. && npm install` (workspaces na raiz)
- **Build:** `cd ../.. && npm run build`
- **Output:** `dist` (relativo a `apps/instrument`)

**Não** uses só `npm install && npm run build` dentro de `apps/instrument` sem subir à raiz — os pacotes `@hand-gestures/*` não ligam e o `tsc` em `node_modules/.bin` pode falhar com `Permission denied` (exit 126).

### Erro `tsc: Permission denied` (code 126)

Causa típica: install na raiz do monorepo mas build no subpacote, ou binários `.bin` sem bit de execução. O script de build usa `npx tsc` e o install deve correr na **raiz** do monorepo (opção A ou B acima).

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
