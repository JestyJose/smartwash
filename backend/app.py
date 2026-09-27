from ultralytics import YOLO
import os
from .utils.classifier import Classifier

class inferance:
    def __init__(self):
        self.path = os.path.dirname(os.path.abspath(__file__))
        self.classification_model = YOLO(os.path.join(self.path, "models/classifier/best.pt"))
        self.classifier = Classifier(model=self.classification_model)

    def predict(self, image):
        conf_threshold = 0.60
        result = self.classifier.get_result(image, conf=conf_threshold)
        if result:
            _class, _conf = result
            if _class and _conf >= conf_threshold:
                return {"class": _class, "confidence": _conf}
        return {"class": "background", "confidence": 1.0}

if __name__ == "__main__":
    infr = inferance()
    result = infr.predict("your/image.jpeg")
    print(result)