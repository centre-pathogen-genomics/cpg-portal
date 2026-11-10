ARG MINIFORGE_IMAGE=condaforge/miniforge3
FROM ${MINIFORGE_IMAGE}
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      bzip2 ca-certificates coreutils curl diffutils file findutils gawk git \
      grep gzip less libgomp1 pigz procps python3 tar tzdata unzip wget \
      xz-utils zip zstd \
 && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /work /tmp /inputs /conda
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8
