import argparse
import time
from collections import deque
from dataclasses import dataclass
from typing import Optional, Tuple

import cv2
import numpy as np

from detector import FaceDetector

MODEL_POINTS = np.array(
    [
        (0.0, 0.0, 0.0),
        (-165.0, -170.0, -135.0),
        (165.0, -170.0, -135.0),
        (-150.0, 150.0, -125.0),
        (150.0, 150.0, -125.0),
    ],
    dtype=np.float64,
)

PNP_FLAG = getattr(cv2, "SOLVEPNP_SQPNP", cv2.SOLVEPNP_EPNP)


@dataclass
class HeadPose:
    yaw: float
    pitch: float
    roll: float
    rvec: np.ndarray
    tvec: np.ndarray


def head_pose(face: np.ndarray, frame_size: Tuple[int, int]) -> Optional[HeadPose]:
    w, h = frame_size
    lm = face[4:14].reshape(5, 2).astype(np.float64)
    image_points = np.array([lm[2], lm[0], lm[1], lm[3], lm[4]])
    camera = np.array(
        [[w, 0, w / 2], [0, w, h / 2], [0, 0, 1]], dtype=np.float64
    )
    ok, rvec, tvec = cv2.solvePnP(
        MODEL_POINTS, image_points, camera, None, flags=PNP_FLAG
    )
    if not ok:
        return None
    rvec, tvec = cv2.solvePnPRefineLM(
        MODEL_POINTS, image_points, camera, None, rvec, tvec
    )
    rot, _ = cv2.Rodrigues(rvec)
    pitch, yaw, roll = cv2.RQDecomp3x3(rot)[0]
    if pitch > 90:
        pitch -= 180
    elif pitch < -90:
        pitch += 180
    return HeadPose(float(yaw), float(pitch), float(roll), rvec, tvec)


def is_attentive(pose: HeadPose, yaw_limit: float = 25.0, pitch_limit: float = 20.0) -> bool:
    return abs(pose.yaw) < yaw_limit and abs(pose.pitch) < pitch_limit


class PoseSmoother:
    def __init__(self, window: int = 5):
        self._samples = deque(maxlen=window)

    def add(self, pose: HeadPose) -> HeadPose:
        self._samples.append((pose.yaw, pose.pitch, pose.roll))
        yaw, pitch, roll = np.median(np.array(self._samples), axis=0)
        return HeadPose(float(yaw), float(pitch), float(roll), pose.rvec, pose.tvec)

    def reset(self):
        self._samples.clear()


def main():
    parser = argparse.ArgumentParser(description="Echo attention monitor (manual test)")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--interval", type=float, default=0.3)
    parser.add_argument("--yaw", type=float, default=25.0)
    parser.add_argument("--pitch", type=float, default=20.0)
    parser.add_argument("--calibrate", action="store_true")
    parser.add_argument("--center-yaw", type=float, default=0.0)
    parser.add_argument("--center-pitch", type=float, default=0.0)
    parser.add_argument("--show", action="store_true")
    args = parser.parse_args()

    detector = FaceDetector()
    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise SystemExit(f"CV: camera {args.camera} unavailable")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    smoother = PoseSmoother()
    center_yaw, center_pitch = args.center_yaw, args.center_pitch

    if args.calibrate:
        print("calibrating: look at your screen normally...")
        samples = []
        while len(samples) < 10:
            cap.grab()
            ok, frame = cap.read()
            if not ok:
                continue
            h, w = frame.shape[:2]
            faces = detector.detect(frame)
            if len(faces) > 0:
                face = max(faces, key=lambda f: f[2] * f[3])
                pose = head_pose(face, (w, h))
                if pose is not None:
                    samples.append((pose.yaw, pose.pitch))
            time.sleep(0.2)
        center_yaw, center_pitch = np.median(np.array(samples), axis=0)
        print(
            f"calibrated center: yaw {center_yaw:+.1f} pitch {center_pitch:+.1f} "
            f"(reuse with --center-yaw {center_yaw:.1f} --center-pitch {center_pitch:.1f})"
        )

    print(f"watching camera {args.camera} — thresholds yaw ±{args.yaw}° pitch ±{args.pitch}° — ctrl-c to quit")
    try:
        while True:
            cap.grab()
            ok, frame = cap.read()
            if not ok:
                continue
            h, w = frame.shape[:2]
            faces = detector.detect(frame)
            if len(faces) == 0:
                print("no face")
                smoother.reset()
            else:
                face = max(faces, key=lambda f: f[2] * f[3])
                pose = head_pose(face, (w, h))
                if pose is None:
                    print("pose failed")
                else:
                    pose = smoother.add(pose)
                    rel = HeadPose(
                        pose.yaw - center_yaw, pose.pitch - center_pitch,
                        pose.roll, pose.rvec, pose.tvec,
                    )
                    state = "ATTENTIVE" if is_attentive(rel, args.yaw, args.pitch) else "away"
                    print(
                        f"yaw {rel.yaw:+6.1f}  pitch {rel.pitch:+6.1f}  "
                        f"roll {rel.roll:+6.1f}  {state}"
                    )
                    if args.show:
                        camera = np.array(
                            [[w, 0, w / 2], [0, w, h / 2], [0, 0, 1]],
                            dtype=np.float64,
                        )
                        tip, _ = cv2.projectPoints(
                            np.array([(0.0, 0.0, 500.0)]),
                            pose.rvec, pose.tvec, camera, None,
                        )
                        nose = tuple(face[8:10].astype(int))
                        cv2.line(
                            frame, nose, tuple(tip.ravel().astype(int)),
                            (0, 255, 0) if state == "ATTENTIVE" else (0, 0, 255), 2,
                        )
            if args.show:
                cv2.imshow("echo attention", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
            time.sleep(args.interval)
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        if args.show:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
