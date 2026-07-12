import time
from collections import deque
from typing import Optional

import cv2
import numpy as np


class WaveDetector:
    """Motion-only hand-wave detector.

    Frame-differences consecutive frames, finds the largest moving blob (a
    waving hand), tracks its horizontal centroid, and fires when the blob
    reverses direction back and forth enough times. Pure OpenCV — no ML model.
    """

    def __init__(
        self,
        min_area: float = 300.0,
        min_travel: float = 12.0,
        min_reversals: int = 2,
        window: int = 15,
        cooldown: float = 3.0,
    ):
        self.min_area = min_area
        self.min_travel = min_travel
        self.min_reversals = min_reversals
        self.window = window
        self.cooldown = cooldown
        self._prev: Optional[np.ndarray] = None
        self._track: deque = deque()
        self._last_wave = 0.0

    def _prepare(self, frame: np.ndarray) -> np.ndarray:
        small = cv2.resize(frame, (160, 120))
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        return cv2.GaussianBlur(gray, (21, 21), 0)

    def _reversals(self) -> int:
        xs = list(self._track)
        if len(xs) < 3:
            return 0
        reversals = 0
        direction = 0
        anchor = xs[0]
        for x in xs[1:]:
            move = x - anchor
            if abs(move) >= self.min_travel:
                d = 1 if move > 0 else -1
                if direction != 0 and d != direction:
                    reversals += 1
                direction = d
                anchor = x
        return reversals

    def step(self, frame: np.ndarray) -> bool:
        now = time.monotonic()
        prepared = self._prepare(frame)
        if self._prev is None:
            self._prev = prepared
            return False

        delta = cv2.absdiff(self._prev, prepared)
        self._prev = prepared
        _, thresh = cv2.threshold(delta, 25, 255, cv2.THRESH_BINARY)
        thresh = cv2.dilate(thresh, None, iterations=2)

        contours, _ = cv2.findContours(
            thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            return False
        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) < self.min_area:
            return False
        m = cv2.moments(largest)
        if m["m00"] == 0:
            return False
        cx = m["m10"] / m["m00"]

        self._track.append(cx)
        while len(self._track) > self.window:
            self._track.popleft()

        if (
            self._reversals() >= self.min_reversals
            and now - self._last_wave > self.cooldown
        ):
            self._last_wave = now
            self._track.clear()
            self._prev = None
            return True
        return False


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Echo wave-to-wake (manual test)")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--interval", type=float, default=0.15)
    parser.add_argument("--min-area", type=float, default=300.0)
    parser.add_argument("--min-travel", type=float, default=12.0)
    parser.add_argument("--reversals", type=int, default=2)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    detector = WaveDetector(
        min_area=args.min_area,
        min_travel=args.min_travel,
        min_reversals=args.reversals,
    )
    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise SystemExit(f"CV: camera {args.camera} unavailable")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    print(f"CV: watching camera {args.camera} for waves")
    try:
        while True:
            cap.grab()
            ok, frame = cap.read()
            if not ok:
                continue
            if detector.step(frame):
                print(f"[{time.strftime('%H:%M:%S')}] wave detected")
            elif args.verbose:
                print(f"[{time.strftime('%H:%M:%S')}] reversals={detector._reversals()}")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()


if __name__ == "__main__":
    main()
