import argparse
import os
import time
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from detector import MODELS_DIR, FaceDetector, ensure_model

SFACE_FILENAME = "face_recognition_sface_2021dec.onnx"
SFACE_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    f"face_recognition_sface/{SFACE_FILENAME}"
)
FACES_DIR = os.path.join(MODELS_DIR, "faces")
MATCH_THRESHOLD = 0.363


class FaceIdentifier:
    def __init__(self):
        self._rec = cv2.FaceRecognizerSF.create(
            ensure_model(SFACE_FILENAME, SFACE_URL), ""
        )
        self.known: Dict[str, np.ndarray] = {}
        if os.path.isdir(FACES_DIR):
            for f in os.listdir(FACES_DIR):
                if f.endswith(".npy"):
                    self.known[f[:-4]] = np.load(os.path.join(FACES_DIR, f))

    def embed(self, frame: np.ndarray, face: np.ndarray) -> np.ndarray:
        aligned = self._rec.alignCrop(frame, face)
        feat = self._rec.feature(aligned).copy().ravel()
        return feat / np.linalg.norm(feat)

    def identify(self, frame: np.ndarray, face: np.ndarray) -> Tuple[Optional[str], float]:
        feat = self.embed(frame, face)
        best_name, best_score = None, -1.0
        for name, ref in self.known.items():
            score = float(np.dot(feat, ref))
            if score > best_score:
                best_name, best_score = name, score
        if best_score >= MATCH_THRESHOLD:
            return best_name, best_score
        return None, best_score

    def save(self, name: str, embedding: np.ndarray):
        os.makedirs(FACES_DIR, exist_ok=True)
        np.save(os.path.join(FACES_DIR, f"{name}.npy"), embedding)
        self.known[name] = embedding


def describe(names: List[Optional[str]]) -> str:
    if not names:
        return "nobody"
    known = sorted(n for n in names if n)
    unknown = sum(1 for n in names if n is None)
    parts = known + ([f"{unknown} unknown"] if unknown else [])
    label = " + ".join(parts)
    if unknown and known:
        return f"{label}  !! shoulder surfer"
    if unknown:
        return f"{label}  !! unrecognized"
    return label


def enroll(args):
    detector = FaceDetector()
    identifier = FaceIdentifier()
    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise SystemExit(f"CV: camera {args.camera} unavailable")

    print(f"enrolling '{args.name}': look at the camera, alone in frame...")
    samples = []
    while len(samples) < args.samples:
        cap.grab()
        ok, frame = cap.read()
        if not ok:
            continue
        faces = detector.detect(frame)
        if len(faces) != 1:
            print(f"  need exactly 1 face in frame (saw {len(faces)})")
            time.sleep(0.5)
            continue
        samples.append(identifier.embed(frame, faces[0]))
        print(f"  captured {len(samples)}/{args.samples}")
        time.sleep(0.4)
    cap.release()

    mean = np.mean(samples, axis=0)
    identifier.save(args.name, mean / np.linalg.norm(mean))
    print(f"saved embedding for '{args.name}' to {FACES_DIR}")


def watch(args):
    detector = FaceDetector()
    identifier = FaceIdentifier()
    if not identifier.known:
        print("warning: no enrolled faces — everyone will be unknown (run enroll first)")
    else:
        print(f"enrolled: {', '.join(sorted(identifier.known))}")

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise SystemExit(f"CV: camera {args.camera} unavailable")

    last = None
    print(f"watching camera {args.camera} every {args.interval}s — ctrl-c to quit")
    try:
        while True:
            cap.grab()
            ok, frame = cap.read()
            if not ok:
                continue
            faces = detector.detect(frame)
            names = [identifier.identify(frame, f)[0] for f in faces]
            state = describe(names)
            if state != last:
                print(f"[{time.strftime('%H:%M:%S')}] {state}")
                last = state
            time.sleep(args.interval)
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()


def main():
    parser = argparse.ArgumentParser(description="Echo privacy guard (manual test)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_enroll = sub.add_parser("enroll", help="capture and save a face embedding")
    p_enroll.add_argument("--name", required=True)
    p_enroll.add_argument("--camera", type=int, default=0)
    p_enroll.add_argument("--samples", type=int, default=10)

    p_watch = sub.add_parser("watch", help="report who is in frame on change")
    p_watch.add_argument("--camera", type=int, default=0)
    p_watch.add_argument("--interval", type=float, default=1.0)

    args = parser.parse_args()
    if args.cmd == "enroll":
        enroll(args)
    else:
        watch(args)


if __name__ == "__main__":
    main()
