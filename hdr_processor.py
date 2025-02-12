import cv2
import numpy as np


def merge_hdr(image_data, apply_clahe=True):
    """
    Merge bracketed images into an HDR image.

    Parameters:
      image_data (list): List of binary image data.
      apply_clahe (bool): If True, applies CLAHE to enhance local contrast.

    Returns:
      bytes: PNG encoded HDR image.
    """
    # 1. Decode images as BGR.
    images = [
        cv2.imdecode(np.frombuffer(img.to_bytes(), np.uint8), cv2.IMREAD_COLOR)
        for img in image_data
    ]

    # 2. Align images using AlignMTB for robust alignment.
    aligner = cv2.createAlignMTB()
    aligner.process(images, images)

    # 3. Merge HDR using MergeMertens.
    merger = cv2.createMergeMertens()
    hdr = merger.process(images)

    # 4. Convert merged HDR image to 8-bit.
    hdr_8bit = np.clip(hdr * 255, 0, 255).astype(np.uint8)

    if apply_clahe:
        # 5. Apply CLAHE to the L channel in LAB space.
        lab = cv2.cvtColor(hdr_8bit, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        lab_enhanced = cv2.merge((cl, a, b))
        final = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)
        # 5b. Enhance saturation: Convert to HSV, boost the S channel by 20%, then convert back.
        hsv = cv2.cvtColor(final, cv2.COLOR_BGR2HSV)
        h_channel, s_channel, v_channel = cv2.split(hsv)
        s_channel = np.clip(s_channel.astype(np.float32) * 1.2, 0, 255).astype(np.uint8)
        hsv_enhanced = cv2.merge((h_channel, s_channel, v_channel))
        final = cv2.cvtColor(hsv_enhanced, cv2.COLOR_HSV2BGR)
    else:
        final = hdr_8bit

    # 6. Encode the final image as PNG.
    _, buffer = cv2.imencode('.png', final)
    return buffer.tobytes()
