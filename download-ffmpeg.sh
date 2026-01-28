#!/bin/bash
# Download ffmpeg binaries for all platforms

echo "Downloading ffmpeg binaries..."

mkdir -p resources/ffmpeg/{mac,win,linux}

# macOS (ARM64 and x64)
echo "Downloading macOS ffmpeg..."
curl -L https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip -o resources/ffmpeg/mac/ffmpeg.zip
cd resources/ffmpeg/mac && unzip -o ffmpeg.zip && rm ffmpeg.zip && cd ../../..
chmod +x resources/ffmpeg/mac/ffmpeg

# Windows
echo "Downloading Windows ffmpeg..."
echo "Please download Windows ffmpeg from: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
echo "Extract ffmpeg.exe to resources/ffmpeg/win/"

# Linux
echo "Downloading Linux ffmpeg..."
echo "Please download Linux ffmpeg from: https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
echo "Extract ffmpeg to resources/ffmpeg/linux/"

echo ""
echo "Note: Windows and Linux downloads require manual steps."
echo "macOS ffmpeg is ready!"
