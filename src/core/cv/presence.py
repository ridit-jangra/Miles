import argparse
import time
from dataclasses import dataclass
from typing import Callable, Optional

import cv2
import numpy as np

from detector import FaceDetector


@dataclass
class PresenceEvent:
    present: bool
    faces: int
    at: float


class PresenceMonitor:
    def __init__(
        self,
        camera_index: int = 0,
        interval: float = 2.0,
        arrive_after: int = 3,
        leave_after: int = 8,
        on_arrived: Optional[Callable[[PresenceEvent], None]] = None,
        on_left: Optional[Callable[[PresenceEvent], None]] = None,
        on_sample: Optional[Callable[[np.ndarray, np.ndarray, bool], None]] = None,
    ):
        self.camera_index = camera_index
        self.interval = interval
        self.arrive_after = arrive_after
        self.leave_after = leave_after
        self.on_arrived = on_arrived
        self.on_left = on_left
        self.on_sample = on_sample
        self.present = False
        self._face_streak = 0
        self._empty_streak = 0
        self._detector = FaceDetector()
        self._running = False

    def stop(self):
        self._running = False

    def run(self):
        cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            raise RuntimeError(f"CV: camera {self.camera_index} unavailable")
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self._running = True
        try:
            while self._running:
                started = time.monotonic()
                frame = self._grab(cap)
                if frame is not None:
                    self._step(frame)
                elapsed = time.monotonic() - started
                remaining = self.interval - elapsed
                if remaining > 0:
                    time.sleep(remaining)
        finally:
            cap.release()

    def _grab(self, cap) -> Optional[np.ndarray]:
        cap.grab()
        ok = cap.grab()
        if not ok:
            return None
        ok, frame = cap.retrieve()
        return frame if ok else None

    def _step(self, frame: np.ndarray):
        faces = self._detector.detect(frame)
        if len(faces) > 0:
            self._face_streak += 1
            self._empty_streak = 0
        else:
            self._empty_streak += 1
            self._face_streak = 0

        if not self.present and self._face_streak >= self.arrive_after:
            self.present = True
            if self.on_arrived:
                self.on_arrived(PresenceEvent(True, len(faces), time.time()))
        elif self.present and self._empty_streak >= self.leave_after:
            self.present = False
            if self.on_left:
                self.on_left(PresenceEvent(False, 0, time.time()))

        if self.on_sample:
            self.on_sample(frame, faces, self.present)


def main():
    parser = argparse.ArgumentParser(description="Echo presence monitor (manual test)")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--interval", type=float, default=2.0)
    parser.add_argument("--arrive", type=int, default=3)
    parser.add_argument("--leave", type=int, default=8)
    parser.add_argument("--show", action="store_true")
    args = parser.parse_args()

    def stamp() -> str:
        return time.strftime("%H:%M:%S")

    def arrived(ev: PresenceEvent):
        print(f"[{stamp()}] ARRIVED ({ev.faces} face{'s' if ev.faces != 1 else ''})")

    def left(ev: PresenceEvent):
        print(f"[{stamp()}] LEFT")

    monitor = PresenceMonitor(
        camera_index=args.camera,
        interval=args.interval,
        arrive_after=args.arrive,
        leave_after=args.leave,
        on_arrived=arrived,
        on_left=left,
    )

    if args.show:

        def show(frame: np.ndarray, faces: np.ndarray, present: bool):
            for f in faces:
                x, y, w, h = f[:4].astype(int)
                cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
                for lx, ly in f[4:14].reshape(5, 2).astype(int):
                    cv2.circle(frame, (lx, ly), 2, (0, 0, 255), -1)
            label = "PRESENT" if present else "AWAY"
            color = (0, 255, 0) if present else (0, 0, 255)
            cv2.putText(frame, label, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
            cv2.imshow("echo presence", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                monitor.stop()

        monitor.on_sample = show

    print(
        f"[{stamp()}] watching camera {args.camera} every {args.interval}s "
        f"(arrive after {args.arrive}, leave after {args.leave}) — ctrl-c to quit"
    )
    try:
        monitor.run()
    except KeyboardInterrupt:
        pass
    finally:
        if args.show:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
