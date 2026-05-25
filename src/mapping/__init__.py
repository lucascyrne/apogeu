"""Mapeamento YAML → parâmetros de controle musical."""

from src.mapping.loader import HandRole, InstrumentConfig, load_instrument_config
from src.mapping.mapper import GestureMapper

__all__ = ["GestureMapper", "InstrumentConfig", "load_instrument_config"]
