# CLI Python (desenvolvimento)

O motor Python permanece para **pesquisa**, gravação e paridade com o app web.

## Comandos

```bash
pip install -e .

# Overlay + camera (debug local)
hand-gestures --musical --pick-camera

# Sem janela OpenCV (headless + WebSocket)
hand-gestures --musical --headless

# Gravar sessão NDJSON
hand-gestures --musical --record sessao.ndjson

# Exportar fixture de paridade para Vitest
python scripts/parity_export.py
```

## Paridade TS

1. `python scripts/parity_export.py` → `apps/instrument/public/fixtures/parity_gate_open.json`
2. `npm run test:web` — testes em `packages/mapping`

## App web

Produção: `npm run dev` em `apps/instrument` (browser-first).

Dev legado: Python com WS + `http://localhost:5173/?backend=ws`
