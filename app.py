import streamlit as st
import cv2
import numpy as np
from PIL import Image
import io


def merge_hdr(images):
    """Merge bracketed images into HDR."""
    aligner = cv2.createAlignMTB()
    aligner.process(images, images)

    merger = cv2.createMergeMertens()
    hdr = merger.process(images)

    # Convert to 8-bit
    hdr_8bit = np.clip(hdr * 255, 0, 255).astype('uint8')
    return hdr_8bit


# Streamlit UI
st.title("Open HDR Merger 🌄")
st.write("Upload 3-5 bracketed exposure images (same resolution)")
st.write("Tool by: Luiz de Marchi - https://github.com/luizdemarchi")

uploaded_files = st.file_uploader(
    "Choose images (JPG/PNG/TIFF)",
    type=["jpg", "jpeg", "png", "tif"],
    accept_multiple_files=True
)

if uploaded_files:
    if 3 <= len(uploaded_files) <= 5:
        if st.button("Merge HDR"):
            with st.spinner("Processing..."):
                try:
                    # Read images
                    images = []
                    for file in uploaded_files:
                        image = np.array(Image.open(file))
                        images.append(cv2.cvtColor(image, cv2.COLOR_RGB2BGR))

                    # Merge HDR
                    result = merge_hdr(images)

                    # Display preview
                    st.image(cv2.cvtColor(result, cv2.COLOR_BGR2RGB),
                             caption="Merged HDR Preview")

                    # Download button
                    result_pil = Image.fromarray(cv2.cvtColor(result, cv2.COLOR_BGR2RGB))
                    img_byte_arr = io.BytesIO()
                    result_pil.save(img_byte_arr, format='PNG', compress_level=0)

                    st.download_button(
                        label="Download HDR Image (PNG)",
                        data=img_byte_arr.getvalue(),
                        file_name="OpenHDRMerge_Output.png",
                        mime="image/png"
                    )
                except Exception as e:
                    st.error(f"Error: {str(e)}")
    else:
        st.error("Please upload between 3 and 5 images")