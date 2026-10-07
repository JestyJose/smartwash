import os
import urllib.request
import tarfile
import cv2
import random
import shutil
from pathlib import Path
from ultralytics import YOLO

# Configuration
DATASET_URL = "https://github.com/atiselsts/data/raw/master/kaggle-dataset-6classes.tar"
TAR_FILE = "kaggle-dataset-6classes.tar"
EXTRACT_DIR = "extracted_data"
YOLO_DATASET_DIR = "yolo_dataset"
TRAIN_SPLIT = 0.8
FRAME_INTERVAL = 5 # Extract every 5th frame to reduce redundancy

def download_and_extract():
    if not os.path.exists(TAR_FILE):
        print(f"Downloading {DATASET_URL}...")
        urllib.request.urlretrieve(DATASET_URL, TAR_FILE)
        print("Download complete.")
    
    if not os.path.exists(EXTRACT_DIR):
        print("Extracting tar file...")
        with tarfile.open(TAR_FILE, "r") as tar:
            tar.extractall(path=EXTRACT_DIR)
        print("Extraction complete.")

def extract_frames():
    """Extract frames from videos and organize into YOLO classification format (train/val)."""
    print("Extracting frames for YOLO dataset...")
    
    # Create dataset directories
    for split in ['train', 'val']:
        os.makedirs(os.path.join(YOLO_DATASET_DIR, split), exist_ok=True)
    
    # Find the root of the extracted dataset (handling potential nested folders)
    search_path = Path(EXTRACT_DIR)
    # The Kaggle dataset from edi-riga typically has folders like "Step 1", "Step 2", etc.
    # We will search for all mp4 files and organize them based on their parent directory.
    video_files = list(search_path.rglob("*.mp4")) + list(search_path.rglob("*.avi"))
    
    # Group videos by class (parent folder name)
    class_videos = {}
    for video_path in video_files:
        # e.g., "Step 1" -> "Step_1"
        cls_name = video_path.parent.name.replace(" ", "_")
        if cls_name not in class_videos:
            class_videos[cls_name] = []
        class_videos[cls_name].append(video_path)
    
    for cls_name, videos in class_videos.items():
        print(f"Processing class: {cls_name} ({len(videos)} videos)")
        
        # Create class directories in train and val
        os.makedirs(os.path.join(YOLO_DATASET_DIR, 'train', cls_name), exist_ok=True)
        os.makedirs(os.path.join(YOLO_DATASET_DIR, 'val', cls_name), exist_ok=True)
        
        # Shuffle videos for random split
        random.shuffle(videos)
        split_idx = int(len(videos) * TRAIN_SPLIT)
        train_videos = videos[:split_idx]
        val_videos = videos[split_idx:]
        
        def process_videos(video_list, split_name):
            frame_count = 0
            for vid_path in video_list:
                cap = cv2.VideoCapture(str(vid_path))
                vid_name = vid_path.stem
                idx = 0
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    if idx % FRAME_INTERVAL == 0:
                        out_path = os.path.join(YOLO_DATASET_DIR, split_name, cls_name, f"{vid_name}_f{idx}.jpg")
                        cv2.imwrite(out_path, frame)
                        frame_count += 1
                    idx += 1
                cap.release()
            return frame_count
            
        train_frames = process_videos(train_videos, 'train')
        val_frames = process_videos(val_videos, 'val')
        print(f"  -> Extracted {train_frames} train frames, {val_frames} val frames.")

def train_yolo():
    print("Starting YOLO classification training...")
    # Load a pretrained YOLO classification model
    model = YOLO("yolov8n-cls.pt")
    
    # Train the model on the prepared dataset
    # You may adjust epochs, imgsz, and device depending on your hardware
    model.train(
        data=os.path.abspath(YOLO_DATASET_DIR),
        epochs=10,
        imgsz=224, # Standard for classification
        device='cpu' # Change to 0 if you have a GPU
    )
    print("Training complete! The best model is typically saved in runs/classify/train/weights/best.pt")
    print("You can copy it to backend/models/classifier/best.pt to use it in the Smart Wash app.")

if __name__ == "__main__":
    download_and_extract()
    extract_frames()
    train_yolo()
