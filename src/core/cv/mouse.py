import argparse
import math
import time

import cv2
from evdev import UInput, ecodes as e

from hands import HandTracker, THUMB_TIP, INDEX_TIP, MIDDLE_TIP, HAND_CONNECTIONS

# Tuning
SENS = 400.0  # base cursor pixels per unit of normalized fingertip travel
ACCEL_GAIN = 1.2  # how much fast hand motion speeds the cursor up
ACCEL_REF = 0.02  # reference speed (norm/frame) for the accel curve
MAX_ACCEL = 4.0  # cap on the acceleration multiplier
SPEED_SMOOTH = 0.5  # EMA on speed feeding the accel curve (kills noise spikes)
DEADZONE = 0.0008  # normalized micro-tremor floor — ignore movement below this
# Clutch/settle: after any action (scroll, grab, click, hand loss) the cursor
# freezes and the anchor follows your hand so you can reposition freely; once the
# hand holds still it re-locks there and tracking resumes. The pause = "I'm ready".
SETTLE_STILL = 0.010  # per-frame hand speed below which it counts as "held still"
SETTLE_FRAMES = 5  # consecutive still frames needed to re-arm tracking
SCROLL_GAIN = 30.0  # wheel notches per unit of normalized hand travel while grabbing
SCROLL_SMOOTH = 0.6  # EMA on scroll velocity so the drag glides
# Thumb-flick wheel (D): while pointing (index up), flick the thumb up/down to
# scroll. Measured relative to the index knuckle so moving the whole hand doesn't
# count — only the thumb's own motion does.
THUMB_GAIN = 60.0  # wheel notches per unit of relative thumb travel
THUMB_SMOOTH = 0.5  # EMA on thumb velocity
THUMB_DEADZONE = 0.006  # min thumb velocity to count as a flick (ignores pointing wobble)
# One Euro filter — adaptive jitter smoothing (lower mincutoff = smoother/laggier,
# higher beta = snappier on fast moves).
EURO_MINCUTOFF = 0.5
EURO_BETA = 0.02


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
            e.EV_REL: [e.REL_X, e.REL_Y, e.REL_WHEEL, e.REL_WHEEL_HI_RES],
        }
        self.ui = UInput(caps, name="echo-hand-mouse")
        self._down = False
        self._wheel_hr = 0.0  # hi-res wheel accumulator (120 units = one notch)
        self._wheel_notch = 0.0  # legacy notch accumulator (for apps ignoring hi-res)
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

    def scroll(self, notches: float) -> None:
        # Smooth, proportional scrolling: emit hi-res wheel every frame and
        # legacy notches only as whole lines accumulate, so it tracks the hand.
        wrote = False
        self._wheel_hr += notches * 120.0
        ihr = int(self._wheel_hr)
        if ihr:
            self._wheel_hr -= ihr
            self.ui.write(e.EV_REL, e.REL_WHEEL_HI_RES, ihr)
            wrote = True
        self._wheel_notch += notches
        n = int(self._wheel_notch)
        if n:
            self._wheel_notch -= n
            self.ui.write(e.EV_REL, e.REL_WHEEL, n)
            wrote = True
        if wrote:
            self.ui.syn()

    def reset_scroll(self) -> None:
        self._wheel_hr = 0.0
        self._wheel_notch = 0.0

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
        "  • pinch thumb+MIDDLE to grab the page, move up/down to scroll it\n"
        "  • while pointing, flick your thumb up/down to scroll (wheel)\n"
        "  • drop your hand to release; press q/ESC (window) or Ctrl-C to quit"
    )

    smx = smy = None
    rem_x = rem_y = 0.0
    speed_ema = 0.0
    scroll_prev_y = None
    scroll_vel = 0.0
    thumb_prev = None
    thumb_vel = 0.0
    settling = True
    still_ctr = 0
    fx, fy = OneEuro(), OneEuro()
    try:
        while True:
            cap.grab()
            ok, frame = cap.read()
            if not ok:
                continue
            frame = cv2.flip(frame, 1)  # mirror: hand-right => cursor-right
            hand = tracker.track(frame)

            grabbing = hand is not None and hand["grab"]

            thumb_scrolling = False

            if hand is None:
                mouse.set_button(False)
                smx = smy = None
                rem_x = rem_y = 0.0
                speed_ema = 0.0
                scroll_prev_y = None
                scroll_vel = 0.0
                thumb_prev = None
                thumb_vel = 0.0
                settling = True
                still_ctr = 0
                fx.reset()
                fy.reset()
            elif grabbing:
                # grab (thumb+middle): pin the page and drag it up/down to scroll,
                # like grabbing a touchscreen. No cursor movement, no click.
                mouse.set_button(False)
                smx = smy = None
                rem_x = rem_y = 0.0
                speed_ema = 0.0
                thumb_prev = None
                thumb_vel = 0.0
                settling = True
                still_ctr = 0
                fx.reset()
                fy.reset()
                sy = hand["grab_y"]
                if scroll_prev_y is None:
                    scroll_prev_y = sy  # seed on grab, no jump
                    scroll_vel = 0.0
                else:
                    d = sy - scroll_prev_y  # hand down => page follows down (scroll up)
                    scroll_prev_y = sy
                    scroll_vel = SCROLL_SMOOTH * d + (1 - SCROLL_SMOOTH) * scroll_vel
                    mouse.scroll(scroll_vel * SCROLL_GAIN)
            else:
                scroll_prev_y = None
                scroll_vel = 0.0

                # thumb-flick wheel (D): thumb motion relative to the index knuckle,
                # so moving the whole hand doesn't count — only the thumb flicking.
                if hand["index_up"]:
                    tr = hand["thumb_rel"]
                    if thumb_prev is None:
                        thumb_prev = tr
                        thumb_vel = 0.0
                    else:
                        td = thumb_prev - tr  # thumb up (rel y↓) => scroll up
                        thumb_prev = tr
                        thumb_vel = THUMB_SMOOTH * td + (1 - THUMB_SMOOTH) * thumb_vel
                        if abs(thumb_vel) > THUMB_DEADZONE:
                            mouse.scroll(thumb_vel * THUMB_GAIN)
                            thumb_scrolling = True
                else:
                    thumb_prev = None
                    thumb_vel = 0.0

                if thumb_scrolling:
                    # while flicking, freeze the cursor and don't click
                    mouse.set_button(False)
                    smx = smy = None
                    rem_x = rem_y = 0.0
                    speed_ema = 0.0
                    settling = True
                    still_ctr = 0
                    fx.reset()
                    fy.reset()
                else:
                    t = time.monotonic()
                    cx = fx(hand["x"], t)
                    cy = fy(hand["y"], t)
                    if smx is None:
                        smx, smy = cx, cy  # (re)acquire: seed, don't jump
                        rem_x = rem_y = 0.0
                        speed_ema = 0.0
                        settling = True
                        still_ctr = 0
                    elif settling:
                        # clutch: cursor frozen, anchor follows the hand until it
                        # holds still — lets you reposition without moving anything.
                        dxs, dys = cx - smx, cy - smy
                        smx, smy = cx, cy
                        if math.hypot(dxs, dys) < SETTLE_STILL:
                            still_ctr += 1
                        else:
                            still_ctr = 0
                        if still_ctr >= SETTLE_FRAMES:
                            settling = False
                            still_ctr = 0
                        mouse.set_button(False)  # no click while repositioning
                    else:
                        dx, dy = cx - smx, cy - smy
                        smx, smy = cx, cy
                        dist = math.hypot(dx, dy)
                        if dist < DEADZONE:  # micro-tremor floor
                            dx = dy = dist = 0.0
                        # accel from a smoothed speed so noise spikes don't blow up
                        speed_ema = SPEED_SMOOTH * dist + (1 - SPEED_SMOOTH) * speed_ema
                        accel = min(1.0 + ACCEL_GAIN * speed_ema / ACCEL_REF, MAX_ACCEL)
                        gain = args.sens * accel
                        fpx = dx * gain + rem_x  # carry sub-pixel remainder for smooth slow moves
                        fpy = dy * gain + rem_y
                        ipx, ipy = int(fpx), int(fpy)
                        rem_x, rem_y = fpx - ipx, fpy - ipy
                        mouse.move(ipx, ipy)
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
                    # grab link: thumb <-> middle tip, lit orange while grabbing
                    grab_col = (0, 165, 255) if grabbing else (180, 120, 0)
                    cv2.line(frame, px[THUMB_TIP], px[MIDDLE_TIP], grab_col, 3)
                    cv2.circle(frame, px[MIDDLE_TIP], 7, grab_col, 2)

                if hand is None:
                    status, color = "no hand", (0, 0, 255)
                elif grabbing:
                    status, color = "GRAB / SCROLL", (0, 165, 255)
                elif thumb_scrolling:
                    status, color = "THUMB SCROLL", (255, 200, 0)
                elif settling:
                    status, color = "settle (hold still)", (160, 160, 160)
                elif hand["pinch"]:
                    status, color = "CLICK / DRAG", (0, 0, 255)
                else:
                    status, color = "MOVE", (0, 255, 0)
                cv2.putText(
                    frame, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2
                )
                if hand:
                    info = f"pinch={hand['ratio']} grab={hand['grab_ratio']}"
                    cv2.putText(
                        frame,
                        info,
                        (10, 62),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (255, 255, 255),
                        2,
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
