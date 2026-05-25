"""WebSocket hub para broadcast de eventos NDJSON ao vivo."""

from __future__ import annotations

import asyncio
import threading
from collections.abc import Callable
from typing import Any

_clients: set[Any] = set()
_loop: asyncio.AbstractEventLoop | None = None
_thread: threading.Thread | None = None
_port: int = 8765


async def _handler(websocket: Any) -> None:
    _clients.add(websocket)
    try:
        async for _ in websocket:
            pass
    finally:
        _clients.discard(websocket)


async def _run_server(port: int) -> None:
    import websockets

    async with websockets.serve(_handler, "localhost", port):
        await asyncio.Future()


def _thread_main(port: int) -> None:
    global _loop
    _loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_loop)
    _loop.run_until_complete(_run_server(port))


def start_ws_server(port: int = 8765) -> Callable[[str], None]:
    """Inicia servidor WS em thread daemon; retorna função broadcast."""
    global _thread, _port
    _port = port
    if _thread is not None and _thread.is_alive():
        return broadcast

    _thread = threading.Thread(target=_thread_main, args=(port,), daemon=True)
    _thread.start()

    for _ in range(50):
        if _loop is not None:
            break
        threading.Event().wait(0.02)

    return broadcast


def broadcast(line: str) -> None:
    if _loop is None or not _clients:
        return

    async def _send() -> None:
        dead: list[Any] = []
        for ws in list(_clients):
            try:
                await ws.send(line)
            except Exception:
                dead.append(ws)
        for ws in dead:
            _clients.discard(ws)

    asyncio.run_coroutine_threadsafe(_send(), _loop)
