import math

UNIT_SECONDS = {"s": 1, "m": 60, "h": 3600}

def parse_time(interval: str) -> float:
    interval = interval.strip().lower()

    if interval == "":
        raise ValueError("Interval is empty...")

    unit = interval[-1]

    if unit not in UNIT_SECONDS:
        raise ValueError("Time unit should be s, m or h; eg: 1s, 2h, 30m.")

    try:
        number = float(interval[:-1])

        if not math.isfinite(number):
            raise ValueError

    except ValueError:
        raise ValueError(f"Bad interval value {interval!r}, use 30s, 5m or 1h.")

    if number <= 0:
        raise ValueError("Time should be above 0 seconds.")

    seconds = number * UNIT_SECONDS[unit]

    return seconds
