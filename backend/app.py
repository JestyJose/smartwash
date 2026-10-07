from ultralytics import YOLO
import os
import numpy as np

class inferance:
    def __init__(self):
        self.path = os.path.dirname(os.path.abspath(__file__))
        self.model_path = os.path.join(self.path, "models/classifier/best.pt")
        self.classification_model = YOLO(self.model_path)
        self.names = self.classification_model.names

    def predict(self, image):
        if image is None:
            return {"class": "background", "confidence": 1.0}

        try:
            results = self.classification_model.predict(image, imgsz=320, verbose=False)
            if not results or not hasattr(results[0], 'probs') or results[0].probs is None:
                return {"class": "background", "confidence": 1.0}

            probs_data = results[0].probs.data.cpu().numpy()
            prob_dict = {self.names[i]: float(probs_data[i]) for i in range(len(self.names))}
            bg_prob = prob_dict.get('background', 0.0)

            # Sum left/right variations for the 6 WHO steps
            step_scores = {
                "Step_1": prob_dict.get("Step_1", 0.0),
                "Step_2": prob_dict.get("Step_2", 0.0) + prob_dict.get("Step_2_Left", 0.0) + prob_dict.get("Step_2_Right", 0.0),
                "Step_3": prob_dict.get("Step_3", 0.0),
                "Step_4": prob_dict.get("Step_4", 0.0) + prob_dict.get("Step_4_Left", 0.0) + prob_dict.get("Step_4_Right", 0.0),
                "Step_5": prob_dict.get("Step_5", 0.0) + prob_dict.get("Step_5_Left", 0.0) + prob_dict.get("Step_5_Right", 0.0),
                "Step_6": (prob_dict.get("Step_6", 0.0) + prob_dict.get("Step_6_Left", 0.0) + prob_dict.get("Step_6_Right", 0.0) +
                           prob_dict.get("Step_7", 0.0) + prob_dict.get("Step_7_Left", 0.0) + prob_dict.get("Step_7_Right", 0.0)),
            }

            best_step, best_step_score = max(step_scores.items(), key=lambda x: x[1])

            # Find top individual granular hand class (excluding background)
            hand_classes = [(name, p) for name, p in prob_dict.items() if name != 'background']
            best_granular_class, best_granular_prob = max(hand_classes, key=lambda x: x[1]) if hand_classes else ("background", 0.0)

            # If hands are active in frame
            if (best_step_score >= 0.20 or best_granular_prob >= 0.18) and bg_prob < 0.88:
                return {
                    "class": best_granular_class if best_granular_prob >= 0.20 else best_step,
                    "confidence": round(float(max(best_granular_prob, best_step_score)), 3),
                    "step": best_step,
                    "aggregated_score": round(float(best_step_score), 3)
                }

            return {"class": "background", "confidence": round(float(bg_prob), 3)}
        except Exception as e:
            print(f"[inferance.predict] Error: {e}")
            return {"class": "background", "confidence": 1.0}

if __name__ == "__main__":
    infr = inferance()
    dummy = np.zeros((320, 320, 3), dtype=np.uint8)
    print(infr.predict(dummy))