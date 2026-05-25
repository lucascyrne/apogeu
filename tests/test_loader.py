"""Carregamento de config YAML."""

from pathlib import Path

import yaml

from src.mapping.loader import load_instrument_config


def test_pair_section_with_only_comments_parses_as_null(tmp_path: Path) -> None:
    cfg_path = tmp_path / "instrument.yaml"
    cfg_path.write_text(
        "preset: scale_gate\npair:\n  # só comentários\n",
        encoding="utf-8",
    )
    data = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
    assert data["pair"] is None

    cfg = load_instrument_config(cfg_path)
    assert cfg.pair_volume.volume_dist_min is None
    assert cfg.pair_volume.volume_dist_max is None
