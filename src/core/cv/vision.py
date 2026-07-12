import json
import os
import threading
import time
from typing import Callable, Optional

import cv2
import numpy as np

from detector import MODELS_DIR, FaceDetector
from attention import HeadPose, PoseSmoother, head_pose, is_attentive
from privacy import FaceIdentifier
from wave_gesture import WaveDetector
from hands import HandTracker

CALIBRATION_FILE = os.path.join(MODELS_DIR, "attention.json")


class _Sticky:
    def __init__(self, ticks: int):
        self.ticks = ticks
        self.value = None
        self._candidate = None
        self._count = 0

    def push(self, value) -> bool:
        if value == self.value:
            self._candidate = None
            self._count = 0
            return False
        if value == self._candidate:
            self._count += 1
        else:
            self._candidate = value
            self._count = 1
        if self._count >= self.ticks:
            self.value = value
            self._candidate = None
            self._count = 0
            return True
        return False


class VisionService:
    def __init__(
        self,
        on_event: Callable[[dict], None],
        camera_index: int = 0,
        interval: float = 1.0,
        arrive_after: int = 2,
        leave_after: int = 10,
        confirm_ticks: int = 2,
    ):
        self.on_event = on_event
        self.camera_index = camera_index
        self.interval = interval
        self.arrive_after = arrive_after
        self.leave_after = leave_after
        self.confirm_ticks = confirm_ticks
        self._lock = threading.Lock()
        self._state = {
            "available": False,
            "present": False,
            "attentive": None,
            "faces": 0,
            "known": [],
            "unknown": 0,
            "enrolled": False,
        }
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._enroll: Optional[dict] = None
        self._calibrate: Optional[dict] = None

    def snapshot(self) -> dict:
        with self._lock:
            return {"type": "state", **self._state}

    def request_enroll(self, name: str, samples: int = 10) -> bool:
        if not name or self._enroll is not None:
            return False
        self._enroll = {
            "name": name,
            "target": samples,
            "samples": [],
            "deadline": time.monotonic() + 60,
        }
        return True

    def request_calibrate(self, samples: int = 10) -> bool:
        if self._calibrate is not None:
            return False
        self._calibrate = {
            "target": samples,
            "samples": [],
            "deadline": time.monotonic() + 30,
        }
        return True

    def start(self) -> None:
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False

    def _set(self, **updates) -> None:
        with self._lock:
            self._state.update(updates)

    def _emit(self, event: dict) -> None:
        try:
            self.on_event(event)
        except Exception:
            pass

    def _load_center(self) -> tuple:
        try:
            with open(CALIBRATION_FILE) as f:
                d = json.load(f)
            return float(d["yaw"]), float(d["pitch"])
        except Exception:
            return 0.0, 0.0

    def _run(self) -> None:
        detector = FaceDetector()
        try:
            identifier = FaceIdentifier()
        except Exception as e:
            print(f"Vision: face recognition unavailable ({e})")
            identifier = None
        self._set(enrolled=bool(identifier and identifier.known))
        smoother = PoseSmoother()
        waver = WaveDetector()
        try:
            hand_tracker = HandTracker()
        except Exception as e:
            print(f"Vision: hand tracking unavailable ({e})")
            hand_tracker = None
        hand_present = False
        center_yaw, center_pitch = self._load_center()

        cap = None
        read_failures = 0
        face_streak = 0
        empty_streak = 0
        present = False
        att_sticky = _Sticky(self.confirm_ticks)
        priv_sticky = _Sticky(self.confirm_ticks)

        while self._running:
            started = time.monotonic()

            if cap is None:
                cap = cv2.VideoCapture(self.camera_index)
                if not cap.isOpened():
                    cap.release()
                    cap = None
                    self._set(available=False)
                    self._emit({"type": "camera", "available": False})
                    time.sleep(30)
                    continue
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                read_failures = 0
                self._set(available=True)
                self._emit({"type": "camera", "available": True})
                print(f"Vision: watching camera {self.camera_index}")

            cap.grab()
            ok, frame = cap.read()
            if not ok:
                read_failures += 1
                if read_failures >= 10:
                    cap.release()
                    cap = None
                    self._set(available=False)
                    self._emit({"type": "camera", "available": False})
                time.sleep(self.interval)
                continue
            read_failures = 0

            if waver.step(frame):
                self._emit({"type": "gesture", "gesture": "wave"})

            if hand_tracker is not None:
                hand = hand_tracker.track(frame)
                if hand is not None:
                    hand_present = True
                    self._emit({"type": "hand", "present": True, **hand})
                elif hand_present:
                    hand_present = False
                    self._emit({"type": "hand", "present": False})

            faces = detector.detect(frame)
            n = len(faces)
            h, w = frame.shape[:2]
            self._set(faces=n)

            if n > 0:
                face_streak += 1
                empty_streak = 0
            else:
                empty_streak += 1
                face_streak = 0
            if not present and face_streak >= self.arrive_after:
                present = True
                self._set(present=True)
                self._emit({"type": "presence", "present": True})
            elif present and empty_streak >= self.leave_after:
                present = False
                self._set(present=False)
                self._emit({"type": "presence", "present": False})

            attentive = None
            pose = None
            if n > 0:
                face = max(faces, key=lambda f: f[2] * f[3])
                pose = head_pose(face, (w, h))
                if pose is not None:
                    smoothed = smoother.add(pose)
                    rel = HeadPose(
                        smoothed.yaw - center_yaw,
                        smoothed.pitch - center_pitch,
                        smoothed.roll,
                        smoothed.rvec,
                        smoothed.tvec,
                    )
                    attentive = is_attentive(rel)
            else:
                smoother.reset()
            if att_sticky.push(attentive):
                self._set(attentive=attentive)
                self._emit({"type": "attention", "attentive": attentive})

            known: list = []
            unknown = 0
            if identifier is not None and n > 0:
                for f in faces:
                    name, _ = identifier.identify(frame, f)
                    if name:
                        known.append(name)
                    else:
                        unknown += 1
            if priv_sticky.push((tuple(sorted(known)), unknown)):
                self._set(known=sorted(known), unknown=unknown)
                self._emit(
                    {
                        "type": "privacy",
                        "known": sorted(known),
                        "unknown": unknown,
                        "faces": n,
                    }
                )

            if self._enroll is not None:
                e = self._enroll
                if identifier is None:
                    self._enroll = None
                    self._emit(
                        {
                            "type": "enroll_failed",
                            "name": e["name"],
                            "reason": "recognition unavailable",
                        }
                    )
                elif time.monotonic() > e["deadline"]:
                    self._enroll = None
                    self._emit(
                        {"type": "enroll_failed", "name": e["name"], "reason": "timeout"}
                    )
                elif n == 1:
                    e["samples"].append(identifier.embed(frame, faces[0]))
                    if len(e["samples"]) >= e["target"]:
                        mean = np.mean(e["samples"], axis=0)
                        identifier.save(e["name"], mean / np.linalg.norm(mean))
                        self._enroll = None
                        self._set(enrolled=True)
                        self._emit({"type": "enrolled", "name": e["name"]})
                        print(f"Vision: enrolled '{e['name']}'")

            if self._calibrate is not None:
                c = self._calibrate
                if time.monotonic() > c["deadline"]:
                    self._calibrate = None
                    self._emit({"type": "calibrate_failed", "reason": "timeout"})
                elif pose is not None:
                    c["samples"].append((pose.yaw, pose.pitch))
                    if len(c["samples"]) >= c["target"]:
                        center_yaw, center_pitch = (
                            float(v) for v in np.median(np.array(c["samples"]), axis=0)
                        )
                        try:
                            with open(CALIBRATION_FILE, "w") as f:
                                json.dump(
                                    {"yaw": center_yaw, "pitch": center_pitch}, f
                                )
                        except Exception as err:
                            print(f"Vision: failed to save calibration ({err})")
                        self._calibrate = None
                        self._emit(
                            {
                                "type": "calibrated",
                                "yaw": center_yaw,
                                "pitch": center_pitch,
                            }
                        )
                        print(
                            f"Vision: calibrated center yaw {center_yaw:+.1f} "
                            f"pitch {center_pitch:+.1f}"
                        )

            remaining = self.interval - (time.monotonic() - started)
            if remaining > 0:
                time.sleep(remaining)

        if cap is not None:
            cap.release()
