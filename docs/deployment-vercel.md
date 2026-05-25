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

O deploy de produção usa só `vite build` (sem `tsc` no script `build`). Typecheck local/CI: `npm run typecheck`.

Causas comuns na Vercel:

- **Root Directory** = `apps/instrument` sem `cd ../..` no install (só ~100 pacotes no log → workspaces não instalados).
- `package-lock.json` desatualizado ou não commitado no GitHub — usar `npm ci` na raiz.
- Binários `.bin` com CRLF (Windows); o repo inclui `.gitattributes` com `eol=lf`.

Confirma no log do install: deve auditar **centenas** de pacotes (MediaPipe, React, etc.), não ~116.

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
  src="https://apogeu-synth.vercel.app/"
  allow="camera; microphone"
  style="width:100%;min-height:600px;border:0"
  title="Apogeu Instrument"
></iframe>
```

Ou link direto. Após iniciar, o app envia `postMessage({ type: 'instrument.ready', source: 'hand-gestures' })` ao pai (origem do `document.referrer` quando possível).

### CSP `frame-ancestors` (iframe bloqueado / `chrome-error://`)

O deploy envia `Content-Security-Policy: frame-ancestors …` via [`vercel.json`](../vercel.json). **Não** uses `https://*` — não é curinga válida em CSP.

Origens já permitidas por defeito: `'self'`, [horizonte.dev.br](https://www.horizonte.dev.br), `https://*.vercel.app`, Netlify, Cloudflare Pages, GitHub Pages, `localhost` (3000/5173).

**Importante:** `https://*.vercel.app` só cobre subdomínios Vercel (ex. `foo.vercel.app`), **não** sites em domínio próprio como `https://www.horizonte.dev.br` — esses hosts têm de estar listados **explicitamente**.

**Portfólio noutro domínio** (ex. `https://meu-site.com`):

1. Na raiz do repo, corre e commita:
   ```bash
   FRAME_ANCESTORS_EXTRA="https://meu-portfolio.vercel.app https://www.meu-site.com" npm run sync:embed-csp
   ```
2. Redeploy na Vercel.

**Atalho (qualquer site pode embutir):** variável de ambiente na Vercel `EMBED_FRAME_ANCESTORS_ALL=1`, depois `npm run sync:embed-csp` no build local e commit, ou edita manualmente o header para `frame-ancestors *`.

Configuração partilhada: [`config/embed-frame-ancestors.mjs`](../config/embed-frame-ancestors.mjs).

## Dev Python (opcional)

```bash
hand-gestures --musical --pick-camera
# mini-app com ?backend=ws
```
