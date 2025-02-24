FROM debian:bookworm-slim

# Set non-interactive mode for apt-get
ENV DEBIAN_FRONTEND=noninteractive
ENV CDT=https://github.com/AntelopeIO/cdt/releases/download/v4.1.0/cdt_4.1.0-1_amd64.deb

# Install required dependencies, Node.js 22, and Git
RUN apt-get update && \
    apt-get install -y curl git wget libcurl4-gnutls-dev make && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g yarn && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    wget $CDT -O /tmp/cdt.deb && \
    dpkg -i /tmp/cdt.deb && \
    rm -f /tmp/cdt.deb
RUN curl -L https://foundry.paradigm.xyz | bash && \
    /root/.foundry/bin/foundryup

RUN corepack enable

# Set working directory
WORKDIR /pnetwork-v4

COPY package.json .
COPY package-lock.json .
COPY yarn.lock .

RUN yarn 

