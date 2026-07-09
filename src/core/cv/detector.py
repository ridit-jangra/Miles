import os
import urllib.request

import cv2
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.environ.get("ECHO_MODELS_DIR") or os.path.normpath(
    os.path.join(BASE_DIR, "../../../models")
)
YUNET_FILENAME = "face_detection_yunet_2023mar.onnx"
YUNET_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/models/"
    f"face_detection_yunet/{YUNET_FILENAME}"
)


def ensure_model(filename: str, url: str) -> str:
    path = os.path.join(MODELS_DIR, filename)
    if not os.path.isfile(path):
        os.makedirs(MODELS_DIR, exist_ok=True)
        print(f"CV: downloading {filename}")
        urllib.request.urlretrieve(url, path)
    return path


class FaceDetector:
    def __init__(self, score_threshold: float = 0.7):
        self._size = (320, 240)
        self._detector = cv2.FaceDetectorYN.create(
            ensure_model(YUNET_FILENAME, YUNET_URL), "", self._size,
            score_threshold, 0.3, 5000
        )

    def detect(self, frame: np.ndarray) -> np.ndarray:
        h, w = frame.shape[:2]
        if (w, h) != self._size:
            self._detector.setInputSize((w, h))
            self._size = (w, h)
        _, faces = self._detector.detect(frame)
        if faces is None:
            return np.empty((0, 15), dtype=np.float32)
        return faces


def main():
    import argparse

    parser = argparse.ArgumentParser(description="One-shot face detection test")
    parser.add_argument("--camera", type=int, default=0)
    args = parser.parse_args()

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        raise SystemExit(f"CV: camera {args.camera} unavailable")
    cap.grab()
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise SystemExit("CV: failed to read a frame")

    faces = FaceDetector().detect(frame)
    print(f"{len(faces)} face(s) in {frame.shape[1]}x{frame.shape[0]} frame")
    for i, f in enumerate(faces):
        x, y, w, h = f[:4].astype(int)
        print(f"  face {i}: box=({x},{y},{w},{h}) score={f[14]:.2f}")


if __name__ == "__main__":
    main()
