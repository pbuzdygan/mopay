FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y build-essential gcc --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
VOLUME ["/app/data"]
CMD ["gunicorn","-b","0.0.0.0:8000","app.app:app","--workers","2"]
