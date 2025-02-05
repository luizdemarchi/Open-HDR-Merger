import cv2
import numpy as np


def align_images(images):
    if not images:
        return []

    # Align using Enhanced Correlation Coefficient (ECC) on grayscale
    base_gray = cv2.cvtColor(images[0], cv2.COLOR_BGR2GRAY)
    aligned = [images[0]]
    warp_mode = cv2.MOTION_HOMOGRAPHY  # More robust alignment

    for img in images[1:]:
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        warp_matrix = np.eye(3, 3, dtype=np.float32)

        try:
            # Find transformation matrix
            _, warp_matrix = cv2.findTransformECC(
                base_gray, img_gray,
                warp_matrix, warp_mode,
                criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 50, 0.001)
            )
            aligned_img = cv2.warpPerspective(
                img, warp_matrix,
                (img.shape[1], img.shape[0]),
                flags=cv2.INTER_LANCZOS4  # High-quality interpolation
            )
            aligned.append(aligned_img)
        except:
            aligned.append(img)  # Fallback

    return aligned


def merge_hdr(image_data):
    # 1. Decode images as BGR (OpenCV's default)
    images = [
        cv2.imdecode(np.frombuffer(img.to_bytes(), dtype=np.uint8), cv2.IMREAD_COLOR)
        for img in image_data
    ]

    # 2. Align images (BGR format)
    aligned_images = align_images(images)

    # 3. Merge HDR using Mertens (BGR float32 in [0, 1] range)
    merge_mertens = cv2.createMergeMertens()
    hdr_linear = merge_mertens.process(aligned_images)

    # 4. Tone mapping (Reinhard for dynamic range compression)
    tonemap = cv2.createTonemapReinhard(gamma=2.2)
    hdr_tonemapped = tonemap.process(hdr_linear)

    # 5. Convert BGR to RGB and scale to 8-bit
    hdr_rgb = (hdr_tonemapped[:, :, [2, 1, 0]] * 255).astype(np.uint8)  # BGR to RGB

    # 6. Encode as PNG with sRGB profile
    _, buffer = cv2.imencode('.png', hdr_rgb, [
        cv2.IMWRITE_PNG_COMPRESSION, 5,
        cv2.IMWRITE_PNG_SRGB, 1  # Embed sRGB profile
    ])
    return buffer.tobytes()