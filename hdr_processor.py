import cv2
import numpy as np


def align_images(images):
    if not images:
        return []

    base_gray = cv2.cvtColor(images[0], cv2.COLOR_BGR2GRAY)
    aligned = [images[0]]
    warp_mode = cv2.MOTION_EUCLIDEAN

    for img in images[1:]:
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        warp_matrix = np.eye(2, 3, dtype=np.float32)

        try:
            _, warp_matrix = cv2.findTransformECC(base_gray, img_gray, warp_matrix, cv2.MOTION_EUCLIDEAN)
            aligned_img = cv2.warpAffine(img, warp_matrix, (img.shape[1], img.shape[0]))
            aligned.append(aligned_img)
        except:
            aligned.append(img)

    return aligned


def merge_hdr(image_data):
    # 1. Decode images as BGR (OpenCV's default)
    images = [
        cv2.imdecode(np.frombuffer(img.to_bytes(), dtype=np.uint8), cv2.IMREAD_COLOR)
        for img in image_data
    ]

    # 2. Align images (BGR format)
    aligned_images = align_images(images)

    # 3. Merge using Mertens' algorithm (returns float32 in [0,1] range)
    merge_mertens = cv2.createMergeMertens()
    hdr_merged = merge_mertens.process(aligned_images)

    # 4. Convert BGR to RGB while maintaining float32 format
    hdr_rgb = cv2.cvtColor(hdr_merged, cv2.COLOR_BGR2RGB)

    hdr_rgb = np.power(hdr_rgb, 1 / 2.2)  # Gamma correction

    # 5. Scale to 8-bit and clamp values
    hdr_8bit = np.clip(hdr_rgb * 255, 0, 255).astype(np.uint8)

    # 6. Encode as PNG
    _, buffer = cv2.imencode('.png', hdr_8bit, [cv2.IMWRITE_PNG_COMPRESSION, 5])
    return buffer.tobytes()