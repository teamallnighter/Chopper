from pydub import AudioSegment
from pydub.silence import detect_nonsilent
import os

# Your audio file
input_file = "mudpies/f#.wav"

# Create output folder
filename = os.path.basename(input_file).replace('.wav', '')
output_folder = f"samples/{filename}_bars"
os.makedirs(output_folder, exist_ok=True)

# Load audio
audio = AudioSegment.from_wav(input_file)
bar_length_ms = int((60000 / 145) * 4)

exported_count = 0
skipped_count = 0

for i in range(0, len(audio), bar_length_ms):
    chunk = audio[i:i+bar_length_ms]
    
    # Skip if too quiet (basically silent)
    if chunk.dBFS < -50:  # adjust threshold if needed
        skipped_count += 1
        continue
    
    # Normalize it
    chunk = chunk.normalize()
    
    # Export at 24-bit, 48kHz
    bar_number = exported_count + 1
    chunk.export(
        f"{output_folder}/bar_{bar_number:03d}.wav",
        format="wav",
        parameters=["-acodec", "pcm_s24le"]  # 24-bit PCM
    )
    exported_count += 1

print(f"Exported {exported_count} bars to {output_folder}/")
print(f"Skipped {skipped_count} silent bars")