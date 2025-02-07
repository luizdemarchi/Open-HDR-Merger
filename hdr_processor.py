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
            _, warp_matrix = cv2.findTransformECC(base_gray, img_gray, warp_matrix, warp_mode)
            aligned_img = cv2.warpAffine(img, warp_matrix, (img.shape[1], img.shape[0]))
            aligned.append(aligned_img)
        except Exception as e:
            # If alignment fails, simply use the original image.
            aligned.append(img)

    return aligned

def merge_hdr(image_data):
    # 1. Decode images as BGR.
    images = [
        cv2.imdecode(np.frombuffer(img.to_bytes(), np.uint8), cv2.IMREAD_COLOR)
        for img in image_data
    ]

    # 2. Align images.
    aligned_images = align_images(images)

    # 3. Merge HDR (BGR float32 [0, 1]).
    merge_mertens = cv2.createMergeMertens()
    hdr_merged = merge_mertens.process(aligned_images)

    # 4. Apply gamma correction to fix brightness.
    gamma = 1/1.0  # Brightness.
    hdr_gamma = np.clip(hdr_merged ** gamma, 0, 1)

    # 5. Scale to 8-bit and encode as PNG.
    hdr_8bit = (hdr_gamma * 255).astype(np.uint8)
    _, buffer = cv2.imencode('.png', hdr_8bit)

    return buffer.tobytes()