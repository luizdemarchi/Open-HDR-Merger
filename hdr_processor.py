import cv2
import numpy as np


def merge_hdr(image_data):
    # 1. Decode images as BGR.
    images = [
        cv2.imdecode(np.frombuffer(img.to_bytes(), np.uint8), cv2.IMREAD_COLOR)
        for img in image_data
    ]

    # 2. Align images using AlignMTB for robust alignment of bracketed exposures.
    aligner = cv2.createAlignMTB()
    aligner.process(images, images)

    # 3. Merge HDR using MergeMertens.
    merger = cv2.createMergeMertens()
    hdr = merger.process(images)

    # 4. Convert the merged HDR image to 8-bit.
    hdr_8bit = np.clip(hdr * 255, 0, 255).astype(np.uint8)

    # 5. Encode the final image as PNG.
    _, buffer = cv2.imencode('.png', hdr_8bit)

    return buffer.tobytes()
