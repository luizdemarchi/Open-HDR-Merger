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
            _, warp_matrix = cv2.findTransformECC(base_gray, img_gray, warp_matrix, warp_mode)
            aligned_img = cv2.warpAffine(img, warp_matrix, (img.shape[1], img.shape[0]))
            aligned.append(aligned_img)
        except Exception as e:
            print(f"Alignment failed: {e}")
            aligned.append(img)

    return aligned

def merge_hdr(image_data):
    # Read images as BGR
    images = [
        cv2.imdecode(np.frombuffer(img.to_bytes(), dtype=np.uint8), cv2.IMREAD_COLOR)
        for img in image_data
    ]

    aligned_images = align_images(images)

    # Convert images to float32 for HDR processing
    aligned_images = [img.astype(np.float32) / 255.0 for img in aligned_images]

    # Merge using Mertens' fusion
    merge_mertens = cv2.createMergeMertens()
    hdr_image = merge_mertens.process(aligned_images)

    # Clip to [0, 1] range and scale to 8-bit
    hdr_8bit = np.clip(hdr_image * 255, 0, 255).astype(np.uint8)
    hdr_bgr = cv2.cvtColor(hdr_8bit, cv2.COLOR_RGB2BGR)  # Ensure correct color order

    # Debugging: Check if the HDR image contains valid data
    if hdr_bgr.mean() == 0:
        print("Warning: HDR output is entirely black.")

    # Save as PNG
    _, buffer = cv2.imencode('.png', hdr_bgr, [cv2.IMWRITE_PNG_COMPRESSION, 5])
    return buffer.tobytes()
