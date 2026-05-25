# Hand Gestures

Aplicação Python que usa a webcam para reconhecer gestos das mãos em tempo real com [MediaPipe Gesture Recognizer](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer). Modo **MVP** (1 mão, gestos discretos) e modo **musical** (2 mãos, theremin digital, `control.frame` ~30 Hz + mini-app React/Tone.js).

## Requisitos

- Python 3.10 ou superior
- Webcam funcional
- Windows, macOS ou Linux

## Instalação

```bash
cd hand-gestures
   python -m venv .venv
```

Ative o ambiente virtual conforme o terminal:

| Terminal | Comando |
|----------|---------|
| **Git Bash** (MINGW64) | `source .venv/Scripts/activate` |
| **PowerShell** | `.venv\Scripts\Activate.ps1` |
| **CMD** | `.venv\Scripts\activate.bat` |

No Git Bash, **não** use `.venv\Scripts\activate` — a barra `\` é interpretada como escape e o comando quebra.

Depois de ativar (o prompt deve mostrar `(.venv)`):

```bash
pip install -e .
python scripts/download_model.py
```

Sem venv, você também pode rodar com o Python do venv diretamente (Git Bash):

```bash
.venv/Scripts/python -m pip install -e .
.venv/Scripts/python scripts/download_model.py
.venv/Scripts/hand-gestures --pick-camera
```

O modelo `gesture_recognizer.task` (~10 MB) é salvo em `models/` e não é versionado no git.

## Como executar

**Recomendado** — seletor visual para ver e escolher a webcam:

```bash
hand-gestures --pick-camera
```

Atalho: `hand-gestures -p`

Na janela do seletor: **N** / **P** ou setas para trocar, **1–9** para atalho, **ENTER** para confirmar, **R** para buscar câmeras de novo, **ESC** para cancelar.

Detecção automática (sem seletor):

```bash
hand-gestures
```

Com `--camera auto`, se houver **mais de uma** câmera funcionando, o seletor abre sozinho (use `--no-pick-camera` para pular).

Para listar câmeras só no terminal:

```bash
hand-gestures --list-cameras
# ou
hand-gestures-cameras
```

Use o índice e backend sugeridos na tabela, por exemplo:

```bash
hand-gestures --camera 1 --camera-backend dshow
```

Ou:

```bash
python -m src.main
```

Pressione **q** na janela ou **Ctrl+C** no terminal para encerrar.

### Modo musical (Fase 2) — ao vivo

**Terminal 1** — webcam + WebSocket (janela redimensionável):

```bash
hand-gestures --musical --pick-camera
```

**App unificado (recomendado para Vercel / portfólio):**

```bash
npm install
npm run dev
```

Abra http://localhost:5173 → **Iniciar experiência** (câmera + MediaPipe no browser).

**Dev legado (Python + WebSocket):**

```bash
hand-gestures --musical --pick-camera
# Em outro terminal: npm run dev, URL com ?backend=ws
```

Ver [docs/deployment-vercel.md](docs/deployment-vercel.md) e [docs/python-dev-cli.md](docs/python-dev-cli.md).

O diretório `web/mini-app` foi substituído por `apps/instrument`.

Gravação opcional (debug): `hand-gestures --musical --record events.ndjson`

Detalhes: [docs/musical-mapping.md](docs/musical-mapping.md).

### Opções úteis

```bash
hand-gestures --help
hand-gestures -p
hand-gestures --camera 1
hand-gestures --camera-backend dshow
hand-gestures --no-pick-camera
hand-gestures --with-landmarks
hand-gestures --score-threshold 0.7 --cooldown-ms 500
hand-gestures --musical --emit-rate 30 --instrument config/default-instrument.yaml
```

### Eventos JSON (stdout)

**MVP** — cada mudança de gesto **estável** imprime uma linha JSON:

```json
{"type":"gesture.stable","gesture":"Thumb_Up","score":0.87,"handedness":"Right","timestamp_ms":1234567890,"landmarks":null}
```

**Musical** — adiciona `control.frame` (~30 Hz) e `gesture.stable` com campo `hand`:

```json
{"schema_version":"2","type":"control.frame","preset":"theremin","left":{"presence":true,"pitch_norm":0.71,"pan":-0.2,"mod":0.4},"right":{...},"pair":{"volume_master":0.62,"hands_distance":0.62}}
```

Mensagens de log vão para **stderr** para não misturar com o pipe de eventos:

```bash
hand-gestures 2>log.txt | node consumer.js
```

## Gestos suportados (pré-treinados)

| Gesto | Nome MediaPipe |
|-------|----------------|
| Nenhum | `None` |
| Punho fechado | `Closed_Fist` |
| Palma aberta | `Open_Palm` |
| Apontar para cima | `Pointing_Up` |
| Polegar para baixo | `Thumb_Down` |
| Polegar para cima | `Thumb_Up` |
| Vitória (V) | `Victory` |
| I love you | `ILoveYou` |

## Problemas comuns (Windows)

Se a câmera não for encontrada ou o vídeo não abrir:

1. Use o **seletor visual** (mostra preview de cada dispositivo):
   ```bash
   hand-gestures --pick-camera
   ```
2. Feche Teams, Zoom, Discord ou qualquer app usando a webcam.
3. Liste dispositivos no terminal: `hand-gestures --list-cameras`
4. Nas configurações do Windows, permita acesso à câmera para apps desktop.

Se aparecer `Falha ao ler frame` ou erros `cap_msmf.cpp`, no seletor escolha a câmera com backend **DirectShow** ou rode:

```bash
hand-gestures --camera 1 --camera-backend dshow
```

As mensagens `Custom gesture classifier is not defined` e `Feedback manager` do MediaPipe são avisos normais e não impedem o uso.

## Limitações conhecidas

- MVP: uma mão (`num_hands=1`); musical: duas mãos (`--musical`).
- Apenas gestos **canned** do MediaPipe; gestos custom exigem treinamento futuro.
- Eixo Z (profundidade) é ruidoso em webcam 2D — modulação com peso baixo e suavização.
- Desempenho depende de iluminação, fundo e câmera (meta ≥15 FPS em laptop comum).
- Resolução padrão 640×480 para equilibrar latência e precisão.

## Estrutura do projeto

```
hand-gestures/
├── config/        # default-instrument.yaml
├── src/           # código Python (expression/, mapping/)
├── web/mini-app/  # React + Tone.js (replay NDJSON)
├── scripts/       # download do modelo
├── models/        # gesture_recognizer.task (gerado)
└── docs/          # arquitetura, musical-mapping
```

## Roadmap

1. **MVP** — detecção estável + eventos JSON (1 mão)
2. **Instrumento gestual** — 2 mãos, `control.frame`, YAML, mini-app Tone.js (**atual**)
3. **Web embed** — MediaPipe no browser ou WebSocket
4. **Gestos custom** — treino ONNX / MLP

Detalhes em [docs/architecture.md](docs/architecture.md) e [docs/musical-mapping.md](docs/musical-mapping.md).

## Licença

Uso interno / MVP. MediaPipe possui termos próprios — consulte a documentação Google.
