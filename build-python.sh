#!/bin/bash
# Build Python executable with PyInstaller

echo "Building Python executable..."

# Activate venv
source venv/bin/activate

# Build the Python CLI as a standalone executable
pyinstaller --onefile \
  --name audioSplitCLI \
  --add-data "venv/lib/python3.12/site-packages/pydub:pydub" \
  --add-data "names.py:." \
  --hidden-import pydub \
  --hidden-import pydub.utils \
  --hidden-import pydub.exceptions \
  --hidden-import names \
  audioSplitCLI.py

echo "Python executable built in dist/audioSplitCLI"
