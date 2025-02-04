import cv2
import numpy as np


def align_images(images):
    if len(images) == 0:
        return []

    # Align using ECC maximization (resilient to minor misalignments)
    base_image = images[0]
    aligned = [base_image]
    warp_mode = cv2.MOTION_EUCLIDEAN

    for img in images[1:]:
        # Convert images to grayscale
        base_gray = cv2.cvtColor(base_image, cv2.COLOR_BGR2GRAY)
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Define 2x3 matrix and initialize with identity
        warp_matrix = np.eye(2, 3, dtype=np.float32)
        criteria = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 500, 1e-6)

        # Run ECC alignment
        try:
            _, warp_matrix = cv2.findTransformECC(base_gray, img_gray, warp_matrix, warp_mode, criteria)
            aligned_img = cv2.warpAffine(img, warp_matrix, (img.shape[1], img.shape[0]),
                                         flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP)
            aligned.append(aligned_img)
        except:
            aligned.append(img)  # Fallback if alignment fails

    return aligned


def merge_hdr(image_data_array):
    images = [
        cv2.imdecode(np.frombuffer(img, dtype=np.uint8), cv2.IMREAD_COLOR)
        for img in image_data_array
    ]

    aligned_images = align_images(images)

    # Merge using Mertens algorithm (exposure fusion)
    merge_mertens = cv2.createMergeMertens()
    hdr_image = merge_mertens.process(aligned_images)

    # Convert to 8-bit and save as TIFF
    hdr_8bit = np.clip(hdr_image * 255, 0, 255).astype(np.uint8)
    _, buffer = cv2.imencode('.tiff', hdr_8bit)
    return buffer.tobytes()