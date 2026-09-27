FROM python:3.9

WORKDIR /app

COPY requirements.txt .

RUN pip install --timeout 120 --retries 53 --prefer-binary -r requirements.txt

# install system libraries required by OpenCV (libGL and friends)
RUN apt-get update && apt-get install -y --no-install-recommends \
	libgl1 \
	libglib2.0-0 \
	libsm6 \
	libxrender1 \
	libxext6 \
	&& rm -rf /var/lib/apt/lists/*

# now copy application source
COPY . /app/backend

EXPOSE 4550

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "4550"]
