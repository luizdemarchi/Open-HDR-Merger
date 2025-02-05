import cv2
import numpy as np


def align_images(images):
    if not images:
        return []

    # Align using grayscale (BGR format)
    base_gray = cv2.cvtColor(images[0], cv2.COLOR_BGR2GRAY)
    aligned = [images[0]]
    warp_mode = cv2.MOTION_EUCLIDEAN

    for img in images[1:]:
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        warp_matrix = np.eye(2, 3, dtype=np.float32)

        try:
            # Find transformation matrix
            _, warp_matrix = cv2.findTransformECC(base_gray, img_gray, warp_matrix, cv2.MOTION_EUCLIDEAN)
            aligned_img = cv2.warpAffine(img, warp_matrix, (img.shape[1], img.shape[0]))
            aligned.append(aligned_img)
        except:
            aligned.append(img)  # Fallback

    return aligned


def merge_hdr(image_data):
    # Decode images as BGR (OpenCV's default)
    images = [
        cv2.imdecode(np.frombuffer(img.to_bytes(), dtype=np.uint8), cv2.IMREAD_COLOR)
        for img in image_data
    ]

    aligned_images = align_images(images)

    # Merge HDR (BGR format)
    merge_mertens = cv2.createMergeMertens()
    hdr_image = merge_mertens.process(aligned_images)

    # Convert BGR to RGB by reversing channels (fixes color distortion)
    hdr_rgb = hdr_image[:, :, ::-1]  # Reverse BGR to RGB

    # Scale to 8-bit and encode as PNG
    hdr_8bit = np.clip(hdr_rgb * 255, 0, 255).astype(np.uint8)
    _, buffer = cv2.imencode('.png', hdr_8bit, [cv2.IMWRITE_PNG_COMPRESSION, 5])
    return buffer.tobytes()