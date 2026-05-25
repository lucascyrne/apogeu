"""CLI: lista câmeras que o OpenCV consegue abrir e capturar frames."""

from __future__ import annotations

import argparse
import sys

from src.camera_probe import scan_cameras


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Varre índices de câmera e backends OpenCV (útil no Windows)."
    )
    parser.add_argument(
        "--max-index",
        type=int,
        default=10,
        help="Último índice a testar (0..N-1)",
    )
    parser.add_argument(
        "--backend",
        choices=("auto", "dshow", "msmf", "any"),
        default="auto",
        help="Backend OpenCV para o scan",
    )
    args = parser.parse_args()

    print(f"Varrendo câmeras (índices 0..{args.max_index - 1}, backend={args.backend})...\n")
    results = scan_cameras(backend_preference=args.backend, max_index=args.max_index)

    working = [r for r in results if r.ok]
    failed = [r for r in results if not r.ok]

    if working:
        print("FUNCIONANDO (use --camera <índice> e opcionalmente --camera-backend):")
        print(f"{'Índice':<8} {'Backend':<18} {'Resolução':<12} {'Comando sugerido'}")
        print("-" * 70)
        for r in working:
            backend_flag = ""
            if r.backend_label == "DirectShow":
                backend_flag = " --camera-backend dshow"
            elif r.backend_label == "Media Foundation":
                backend_flag = " --camera-backend msmf"
            cmd = f"hand-gestures --camera {r.index}{backend_flag}"
            print(f"{r.index:<8} {r.backend_label:<18} {r.detail:<12} {cmd}")
        print()
    else:
        print("Nenhuma câmera entregou frames.\n")

    if failed and working:
        print(f"Outras combinações testadas sem sucesso: {len(failed)}")
    elif failed and not working:
        print("Todas as combinações falharam. Verifique:")
        print("  - Privacidade do Windows: permitir câmera para apps desktop")
        print("  - Gerenciador de Dispositivos: driver da webcam")
        print("  - Cabo USB / desconecte e reconecte a câmera")
        print("  - Teste o app 'Câmera' do Windows com o mesmo dispositivo")

    sys.exit(0 if working else 1)


if __name__ == "__main__":
    main()
