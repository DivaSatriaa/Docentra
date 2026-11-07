import json
import os
from pathlib import Path


SETTINGS_PATH = Path(
    os.getenv(
        "SETTINGS_PATH",
        Path(__file__).resolve().parents[1]
        / "data"
        / "settings.json",
    )
)


def _load() -> dict:
    try:
        return json.loads(
            SETTINGS_PATH.read_text(encoding="utf-8"),
        )

    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save(settings: dict) -> None:
    SETTINGS_PATH.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    tmp_path = SETTINGS_PATH.with_suffix(".tmp")

    # The file holds API keys, so keep it readable
    # by the owner only.
    fd = os.open(
        tmp_path,
        os.O_WRONLY | os.O_CREAT | os.O_TRUNC,
        0o600,
    )

    with os.fdopen(fd, "w", encoding="utf-8") as file:
        json.dump(settings, file, indent=2)

    os.replace(tmp_path, SETTINGS_PATH)


def get_setting(key: str) -> str | None:
    value = _load().get(key)

    return value if isinstance(value, str) else None


def set_setting(
    key: str,
    value: str | None,
) -> None:
    settings = _load()

    if value:
        settings[key] = value
    else:
        settings.pop(key, None)

    _save(settings)
