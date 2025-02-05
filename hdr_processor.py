import cv2
import numpy as np


def align_images(images):
    if not images:
        return []

    # Align using grayscale (BGR images)
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
    # Read images as BGR
    images = [
        cv2.imdecode(np.frombuffer(img.to_bytes(), dtype=np.uint8), cv2.IMREAD_COLOR)
        for img in image_data
    ]

    aligned_images = align_images(images)

    # Merge and convert to RGB
    merge_mertens = cv2.createMergeMertens()
    hdr_image = merge_mertens.process(aligned_images)
    hdr_rgb = cv2.cvtColor(hdr_image, cv2.COLOR_BGR2RGB)

    # Save as PNG
    hdr_8bit = np.clip(hdr_rgb * 255, 0, 255).astype(np.uint8)
    _, buffer = cv2.imencode('.png', hdr_8bit, [cv2.IMWRITE_PNG_COMPRESSION, 5])
    return buffer.tobytes()