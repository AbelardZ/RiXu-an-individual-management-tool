import json
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from lunar_python import Solar

from app.core.security import utcnow
from app.schemas.auth import ProfileCreate


ALGORITHM_NAME = "lunar_python"
ALGORITHM_VERSION = "1.4.8"


class BaziError(ValueError):
    pass


@dataclass(frozen=True)
class Pillar:
    stem: str
    branch: str

    @property
    def text(self) -> str:
        return f"{self.stem}{self.branch}"


def _validate_birth_time(value: str) -> tuple[int, int]:
    try:
        hour_text, minute_text = value.split(":", 1)
        hour = int(hour_text)
        minute = int(minute_text)
    except ValueError as exc:
        raise BaziError("birth_time must use HH:MM format") from exc
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise BaziError("birth_time is out of range")
    return hour, minute


def _validate_timezone(value: str) -> None:
    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError as exc:
        raise BaziError("birth_timezone must be a valid IANA timezone") from exc


def _pillar(text: str) -> Pillar:
    if len(text) < 2:
        raise BaziError("calendar engine returned an invalid pillar")
    return Pillar(stem=text[0], branch=text[1])


def _element_counts(values: list[str]) -> dict[str, int]:
    counts = {"木": 0, "火": 0, "土": 0, "金": 0, "水": 0}
    for value in values:
        for element in counts:
            counts[element] += value.count(element)
    return counts


def calculate_bazi(profile: ProfileCreate) -> dict:
    """Calculate four-pillar bazi from civil birth date and time.

    This module intentionally depends on a maintained calendar library instead
    of handwritten calendrical formulas. The input timezone is validated and
    persisted for audit, while the bazi calculation uses the supplied civil
    birth date/time exactly as entered by the user.
    """
    hour, minute = _validate_birth_time(profile.birth_time)
    _validate_timezone(profile.birth_timezone)

    birth_dt = datetime.combine(profile.birth_date, datetime.min.time()).replace(hour=hour, minute=minute)
    solar = Solar.fromYmdHms(
        birth_dt.year,
        birth_dt.month,
        birth_dt.day,
        birth_dt.hour,
        birth_dt.minute,
        0,
    )
    lunar = solar.getLunar()
    eight_char = lunar.getEightChar()
    pillars = {
        "year": _pillar(eight_char.getYear()),
        "month": _pillar(eight_char.getMonth()),
        "day": _pillar(eight_char.getDay()),
        "hour": _pillar(eight_char.getTime()),
    }
    wuxing = [
        eight_char.getYearWuXing(),
        eight_char.getMonthWuXing(),
        eight_char.getDayWuXing(),
        eight_char.getTimeWuXing(),
    ]
    result = {
        "status": "calculated",
        "pillars": {
            key: {"text": pillar.text, "stem": pillar.stem, "branch": pillar.branch}
            for key, pillar in pillars.items()
        },
        "heavenly_stems": [pillar.stem for pillar in pillars.values()],
        "earthly_branches": [pillar.branch for pillar in pillars.values()],
        "five_elements": wuxing,
        "five_element_counts": _element_counts(wuxing),
        "na_yin": [
            eight_char.getYearNaYin(),
            eight_char.getMonthNaYin(),
            eight_char.getDayNaYin(),
            eight_char.getTimeNaYin(),
        ],
        "lunar_text": lunar.toString(),
        "source_birth": {
            "birth_date": profile.birth_date.isoformat(),
            "birth_time": profile.birth_time,
            "birth_timezone": profile.birth_timezone,
            "birth_place": profile.birth_place,
        },
        "algorithm": {
            "name": ALGORITHM_NAME,
            "version": ALGORITHM_VERSION,
            "calculated_at": utcnow().isoformat(),
        },
    }
    return result


def calculate_bazi_json(profile: ProfileCreate) -> tuple[str, str]:
    result = calculate_bazi(profile)
    return "calculated", json.dumps(result, ensure_ascii=False, separators=(",", ":"))
