import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    HandLandmarker,
    HandLandmarkerOptions,
    RunningMode,
)

from detector import ensure_model

MODEL_FILE = "hand_landmarker.task"
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/1/hand_landmarker.task"
)

# MediaPipe hand landmark indices
WRIST = 0
THUMB_TIP = 4
INDEX_MCP = 5
INDEX_TIP = 8
MIDDLE_MCP = 9
MIDDLE_TIP = 12

# finger (tip, pip) pairs — a finger is "up" when its tip is above its pip joint
INDEX_FINGER = (8, 6)
MIDDLE_FINGER = (12, 10)
RING_FINGER = (16, 14)
PINKY_FINGER = (20, 18)

# Scroll: hold index+middle up and slide them vertically. Each SCROLL_STEP of
# normalized fingertip travel emits one scroll tick (up = fingers move up).
SCROLL_STEP = 0.03
SCROLL_GRACE = 5  # frames the pose can drop out before the scroll anchor resets

# Pinch is scale-invariant: thumb-to-index distance divided by palm length
# (wrist -> middle-finger knuckle), so it works whether the hand is near or far.
# Hysteresis: two thresholds so the click doesn't flicker at the boundary.
PINCH_ON = 0.20
PINCH_OFF = 0.20

# Grab = thumb touching MIDDLE finger tip (distinct from the thumb+index click).
# Hold the grab and move your hand up/down to drag-scroll the page.
GRAB_ON = 0.22
GRAB_OFF = 0.30


def _dist(a, b) -> float:
    return ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) ** 0.5


class HandTracker:
    """Tracks one hand and reports the index-fingertip position (normalized 0-1,
    origin top-left) plus a pinch flag (thumb tip touching index tip = a click)."""

    def __init__(self, max_hands: int = 1):
        path = ensure_model(MODEL_FILE, MODEL_URL)
        options = HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=path),
            running_mode=RunningMode.VIDEO,
            num_hands=max_hands,
        )
        self._landmarker = HandLandmarker.create_from_options(options)
        self._ts = 0
        self._pinched = False
        self._grabbed = False
        self._scroll_anchor: float | None = None
        self._scroll_miss = 0
        self.last_landmarks: list[tuple[float, float]] | None = None

    def track(self, frame_bgr) -> dict | None:
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        self._ts += 33  # detect_for_video needs strictly-increasing timestamps
        result = self._landmarker.detect_for_video(image, self._ts)
        if not result.hand_landmarks:
            self.last_landmarks = None
            self._pinched = False
            self._grabbed = False
            self._scroll_anchor = None
            return None
        lm = result.hand_landmarks[0]
        self.last_landmarks = [(p.x, p.y) for p in lm]

        palm = _dist(lm[WRIST], lm[MIDDLE_MCP]) or 1e-6
        ratio = _dist(lm[THUMB_TIP], lm[INDEX_TIP]) / palm
        if self._pinched:
            if ratio > PINCH_OFF:
                self._pinched = False
        else:
            if ratio < PINCH_ON:
                self._pinched = True

        grab_ratio = _dist(lm[THUMB_TIP], lm[MIDDLE_TIP]) / palm
        if self._grabbed:
            if grab_ratio > GRAB_OFF:
                self._grabbed = False
        else:
            if grab_ratio < GRAB_ON:
                self._grabbed = True

        def up(finger):
            return lm[finger[0]].y < lm[finger[1]].y

        scroll_pose = (
            up(INDEX_FINGER)
            and up(MIDDLE_FINGER)
            and not up(RING_FINGER)
            and not up(PINKY_FINGER)
        )
        scroll = None
        cur_y = (lm[INDEX_TIP].y + lm[MIDDLE_TIP].y) / 2  # track the fingertips you slide
        if scroll_pose:
            self._scroll_miss = 0
            if self._scroll_anchor is None:
                self._scroll_anchor = cur_y
            elif cur_y < self._scroll_anchor - SCROLL_STEP:
                scroll = "up"
                self._scroll_anchor = cur_y
            elif cur_y > self._scroll_anchor + SCROLL_STEP:
                scroll = "down"
                self._scroll_anchor = cur_y
        else:
            self._scroll_miss += 1
            if self._scroll_miss > SCROLL_GRACE:
                self._scroll_anchor = None

        index = lm[INDEX_TIP]
        return {
            "x": float(index.x),
            "y": float(index.y),
            "pinch": self._pinched,
            "ratio": round(float(ratio), 2),
            "scroll_pose": scroll_pose,
            "scroll": scroll,
            "scroll_y": float(cur_y) if scroll_pose else None,
            "grab": self._grabbed,
            "grab_ratio": round(float(grab_ratio), 2),
            "grab_y": float(lm[MIDDLE_MCP].y),
            "index_up": bool(up(INDEX_FINGER)),
            "thumb_rel": float(lm[THUMB_TIP].y - lm[INDEX_MCP].y),
        }

    def close(self) -> None:
        try:
            self._landmarker.close()
        except Exception:
            pass


HAND_CONNECTIONS = [
    (0, 1),
    (1, 2),
    (2, 3),
    (3, 4),
    (0, 5),
    (5, 6),
    (6, 7),
    (7, 8),
    (5, 9),
    (9, 10),
    (10, 11),
    (11, 12),
    (9, 13),
    (13, 14),
    (14, 15),
    (15, 16),
    (13, 17),
    (17, 18),
    (18, 19),
    (19, 20),
    (0, 17),
]


def _open_camera(index: int):
    import time

    tried = []
    for idx in [index, 0, 1, 2, 3, 4]:
        if idx in tried:
            continue
        tried.append(idx)
        cap = cv2.VideoCapture(idx)
        if cap.isOpened():
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            cap.grab()
            ok, _ = cap.read()
            if ok:
                if idx != index:
                    print(f"CV: camera {index} unavailable, using camera {idx} instead")
                return cap
        cap.release()
        time.sleep(0.2)
    return None


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Echo hand tracker (manual test)")
    parser.add_argument("--camera", type=int, default=1)
    args = parser.parse_args()

    tracker = HandTracker()
    cap = _open_camera(args.camera)
    if cap is None:
        raise SystemExit(
            f"CV: camera {args.camera} wouldn't open. Try a different --camera index "
            f"(this webcam's working stream is usually 1 or 2)."
        )
    print(
        "CV: tracking — pinch thumb+index to 'click'; hold index+middle up and move "
        "up/down to scroll. Press q or ESC to quit."
    )

    scroll_msg = ""
    scroll_ttl = 0
    try:
        while True:
            cap.grab()
            ok, frame = cap.read()
            if not ok:
                continue
            frame = cv2.flip(frame, 1)  # mirror so movement feels natural
            h, w = frame.shape[:2]
            hand = tracker.track(frame)
            pts = tracker.last_landmarks

            if pts:
                px = [(int(x * w), int(y * h)) for x, y in pts]
                for a, b in HAND_CONNECTIONS:
                    cv2.line(frame, px[a], px[b], (0, 200, 0), 2)
                for p in px:
                    cv2.circle(frame, p, 3, (0, 255, 0), -1)
                clicking = hand and hand["pinch"]
                link_color = (0, 0, 255) if clicking else (255, 200, 0)
                cv2.line(frame, px[THUMB_TIP], px[INDEX_TIP], link_color, 3)
                cv2.circle(frame, px[INDEX_TIP], 10, (0, 255, 255), 2)
                cv2.circle(frame, px[THUMB_TIP], 10, (255, 0, 255), 2)
                if hand:
                    label = f"x={hand['x']:.2f} y={hand['y']:.2f} ratio={hand['ratio']}"
                    cv2.putText(
                        frame,
                        label,
                        (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.7,
                        (255, 255, 255),
                        2,
                    )
                    if clicking:
                        cv2.putText(
                            frame,
                            "CLICK",
                            (10, 70),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            1.2,
                            (0, 0, 255),
                            3,
                        )
                    if hand.get("scroll"):
                        scroll_msg = "SCROLL " + hand["scroll"].upper()
                        scroll_ttl = 8
                    elif hand.get("scroll_pose"):
                        cv2.putText(
                            frame,
                            "scroll ready",
                            (10, 105),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.7,
                            (0, 200, 255),
                            2,
                        )
            else:
                cv2.putText(
                    frame,
                    "no hand",
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 0, 255),
                    2,
                )

            if scroll_ttl > 0:
                scroll_ttl -= 1
                cv2.putText(frame, scroll_msg, (w - 260, 40), cv2.FONT_HERSHEY_SIMPLEX,
                            1.0, (0, 255, 255), 3)

            cv2.imshow("Echo hand tracker", frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (27, ord("q")):
                break
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        tracker.close()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
