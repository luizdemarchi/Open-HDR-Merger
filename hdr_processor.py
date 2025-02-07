import cv2
import numpy as np


def align_images(images):
    if not images:
        return []

    # Align using Enhanced Correlation Coefficient (ECC)
    base_gray = cv2.cvtColor(images[0], cv2.COLOR_BGR2GRAY)
    aligned = [images[0]]
    warp_mode = cv2.MOTION_EUCLIDEAN

    for img in images[1:]:
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        warp_matrix = np.eye(2, 3, dtype=np.float32)

        try:
            # Find transformation matrix
            _, warp_matrix = cv2.findTransformECC(
                base_gray,
                img_gray,
                warp_matrix,
                warp_mode,
                criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 50, 0.001)
            )
            aligned_img = cv2.warpAffine(
                img,
                warp_matrix,
                (img.shape[1], img.shape[0]),
                flags=cv2.INTER_LINEAR
            )
            aligned.append(aligned_img)
        except:
            aligned.append(img)

    return aligned


def merge_hdr(image_data):
    # 1. Decode images (BGR format)
    images = [
        cv2.imdecode(np.frombuffer(img.tobytes(), dtype=np.uint8), cv2.IMREAD_COLOR)
        for img in image_data
    ]

    # 2. Align images
    aligned_images = align_images(images)

    # 3. Merge using Mertens' algorithm
    merge_mertens = cv2.createMergeMertens()
    hdr_merged = merge_mertens.process(aligned_images)

    # 4. Convert to 8-bit RGB (manual channel swap for Pyodide compatibility)
    hdr_rgb = hdr_merged[:, :, [2, 1, 0]]  # BGR to RGB
    hdr_8bit = np.clip(hdr_rgb * 255, 0, 255).astype(np.uint8)

    # 5. Encode as PNG
    _, buffer = cv2.imencode('.png', hdr_8bit)
    return buffer.tobytes()