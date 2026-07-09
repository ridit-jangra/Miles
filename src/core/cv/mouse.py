import argparse
import math
import time

import cv2
from evdev import UInput, ecodes as e

from hands import HandTracker, THUMB_TIP, INDEX_TIP, HAND_CONNECTIONS

# Tuning
SENS = 400.0  # base cursor pixels per unit of normalized fingertip travel
ACCEL_GAIN = 1.2  # how much fast hand motion speeds the cursor up
ACCEL_REF = 0.02  # reference speed (norm/frame) for the accel curve
MAX_ACCEL = 4.0  # cap on the acceleration multiplier
# One Euro filter — adaptive jitter smoothing (lower mincutoff = smoother/laggier,
# higher beta = snappier on fast moves).
EURO_MINCUTOFF = 1.2
EURO_BETA = 0.03


class OneEuro:
    def __init__(self, mincutoff=EURO_MINCUTOFF, beta=EURO_BETA, dcutoff=1.0):
        self.mincutoff = mincutoff
        self.beta = beta
        self.dcutoff = dcutoff
        self.reset()

    def reset(self):
        self.x_prev = None
        self.dx_prev = 0.0
        self.t_prev = None

    @staticmethod
    def _alpha(cutoff, freq):
        tau = 1.0 / (2 * math.pi * cutoff)
        te = 1.0 / freq
        return 1.0 / (1.0 + tau / te)

    def __call__(self, x, t):
        if self.x_prev is None:
            self.x_prev, self.t_prev = x, t
            return x
        freq = 1.0 / max(1e-3, t - self.t_prev)
        self.t_prev = t
        dx = (x - self.x_prev) * freq
        a_d = self._alpha(self.dcutoff, freq)
        dx_hat = a_d * dx + (1 - a_d) * self.dx_prev
        cutoff = self.mincutoff + self.beta * abs(dx_hat)
        a = self._alpha(cutoff, freq)
        x_hat = a * x + (1 - a) * self.x_prev
        self.x_prev, self.dx_prev = x_hat, dx_hat
        return x_hat


class HandMouse:
    def __init__(self):
        caps = {
            e.EV_KEY: [e.BTN_LEFT, e.BTN_RIGHT, e.BTN_MIDDLE],
            e.EV_REL: [e.REL_X, e.REL_Y, e.REL_WHEEL],
        }
        self.ui = UInput(caps, name="echo-hand-mouse")
        self._down = False
        time.sleep(0.3)  # let the compositor register the new device

    def move(self, dx: float, dy: float) -> None:
        ix, iy = int(round(dx)), int(round(dy))
        if ix or iy:
            self.ui.write(e.EV_REL, e.REL_X, ix)
            self.ui.write(e.EV_REL, e.REL_Y, iy)
            self.ui.syn()

    def set_button(self, pressed: bool) -> None:
        if pressed != self._down:
            self._down = pressed
            self.ui.write(e.EV_KEY, e.BTN_LEFT, 1 if pressed else 0)
            self.ui.syn()

    def scroll(self, amount: int) -> None:
        self.ui.write(e.EV_REL, e.REL_WHEEL, amount)
        self.ui.syn()

    def close(self) -> None:
        self.set_button(False)
        self.ui.close()


def _open_camera(index: int):
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
    ap = argparse.ArgumentParser(
        description="Echo hand mouse — control the cursor with your hand"
    )
    ap.add_argument("--camera", type=int, default=1)
    ap.add_argument("--sens", type=float, default=SENS)
    ap.add_argument(
        "--headless", action="store_true", help="run without the preview window"
    )
    args = ap.parse_args()

    tracker = HandTracker()
    cap = _open_camera(args.camera)
    if cap is None:
        raise SystemExit(
            f"CV: camera {args.camera} wouldn't open — try another --camera index."
        )
    mouse = HandMouse()
    print(
        "Hand mouse live:\n"
        "  • point (index up) and move to steer the cursor\n"
        "  • pinch thumb+index to click; hold the pinch to drag\n"
        "  • index+middle up, slide up/down to scroll\n"
        "  • drop your hand to release; press q/ESC (window) or Ctrl-C to quit"
    )

    smx = smy = None
    fx, fy = OneEuro(), OneEuro()
    scroll_msg = ""
    scroll_ttl = 0
    try:
        while True:
            cap.grab()
            ok, frame = cap.read()
            if not ok:
                continue
            frame = cv2.flip(frame, 1)  # mirror: hand-right => cursor-right
            hand = tracker.track(frame)

            if hand is None:
                mouse.set_button(False)
                smx = smy = None
                fx.reset()
                fy.reset()
            elif hand["scroll_pose"]:
                # scroll mode: no cursor movement, no click
                mouse.set_button(False)
                smx = smy = None
                fx.reset()
                fy.reset()
                if hand["scroll"] == "up":
                    mouse.scroll(1)
                elif hand["scroll"] == "down":
                    mouse.scroll(-1)
            else:
                t = time.monotonic()
                cx = fx(hand["x"], t)
                cy = fy(hand["y"], t)
                if smx is None:
                    smx, smy = cx, cy  # (re)acquire: seed, don't jump
                else:
                    dx, dy = cx - smx, cy - smy
                    smx, smy = cx, cy
                    speed = math.hypot(dx, dy)
                    accel = min(1.0 + ACCEL_GAIN * speed / ACCEL_REF, MAX_ACCEL)
                    gain = args.sens * accel
                    px, py = dx * gain, dy * gain
                    if abs(px) < 0.5 and abs(py) < 0.5:  # sub-pixel deadzone
                        px = py = 0.0
                    mouse.move(px, py)
                mouse.set_button(hand["pinch"])  # pinch held = drag

            if not args.headless:
                h, w = frame.shape[:2]
                pts = tracker.last_landmarks
                if pts:
                    px = [(int(a * w), int(b * h)) for a, b in pts]
                    for a, b in HAND_CONNECTIONS:
                        cv2.line(frame, px[a], px[b], (0, 200, 0), 2)
                    tip_color = (
                        (0, 0, 255) if (hand and hand["pinch"]) else (0, 255, 255)
                    )
                    cv2.circle(frame, px[INDEX_TIP], 9, tip_color, -1)
                    cv2.circle(frame, px[THUMB_TIP], 7, (255, 0, 255), 2)

                if hand is None:
                    status, color = "no hand", (0, 0, 255)
                elif hand["scroll_pose"]:
                    status, color = "SCROLL", (0, 200, 255)
                    if hand["scroll"]:
                        scroll_msg = "SCROLL " + hand["scroll"].upper()
                        scroll_ttl = 8
                elif hand["pinch"]:
                    status, color = "CLICK / DRAG", (0, 0, 255)
                else:
                    status, color = "MOVE", (0, 255, 0)
                cv2.putText(
                    frame, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2
                )
                if hand:
                    info = f"x={hand['x']:.2f} y={hand['y']:.2f} ratio={hand['ratio']}"
                    cv2.putText(
                        frame,
                        info,
                        (10, 62),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (255, 255, 255),
                        2,
                    )
                if scroll_ttl > 0:
                    scroll_ttl -= 1
                    cv2.putText(
                        frame,
                        scroll_msg,
                        (w - 260, 40),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        1.0,
                        (0, 255, 255),
                        3,
                    )

                cv2.imshow("Echo hand mouse", frame)
                if (cv2.waitKey(1) & 0xFF) in (27, ord("q")):
                    break
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        mouse.close()
        tracker.close()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
