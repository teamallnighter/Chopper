#!/usr/bin/env python3
"""
Command-line interface for audio splitting.
Called by Electron app with arguments.
"""

import argparse
import json
import os
import random
import sys
import time
from pydub import AudioSegment
from pydub.silence import detect_nonsilent
import librosa
import numpy as np
from names import ADJECTIVES, NOUNS, SUFFIXES

# Musical time mapping for bar mode
MUSICAL_TIME_MAP = {
    '1/16': 0.25,
    '1/8': 0.5,
    '1/4': 1.0,
    '1/2': 2.0,
    '1': 4.0,      # 1 bar = 4 beats in 4/4 time
    '2': 8.0,      # 2 bars
    '4': 16.0,     # 4 bars
    '8': 32.0      # 8 bars
}


def log(message):
    """Print to stdout for Electron to capture"""
    print(message, flush=True)


def detect_key(audio_segment):
    """
    Detect musical key using librosa's chroma features and Krumhansl-Schmuckler algorithm.
    Returns: (key, mode, confidence) e.g., ('C', 'major', 0.82)
    """
    try:
        # Convert pydub AudioSegment to numpy array
        samples = np.array(audio_segment.get_array_of_samples())

        # Normalize to [-1, 1] range
        if audio_segment.sample_width == 2:  # 16-bit
            samples = samples / 32768.0
        elif audio_segment.sample_width == 3:  # 24-bit
            samples = samples / 8388608.0
        elif audio_segment.sample_width == 4:  # 32-bit
            samples = samples / 2147483648.0

        # Handle stereo by taking first channel
        if audio_segment.channels == 2:
            samples = samples[::2]

        # Extract chroma features
        chroma = librosa.feature.chroma_cqt(
            y=samples.astype(float),
            sr=audio_segment.frame_rate,
            hop_length=512
        )

        # Average chroma across time
        chroma_mean = np.mean(chroma, axis=1)

        # Krumhansl-Schmuckler key profiles
        major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

        # Calculate correlation for all 24 keys
        key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        max_corr = -1
        detected_key = 'C'
        detected_mode = 'major'

        for i in range(12):
            # Major key correlation
            major_corr = np.corrcoef(chroma_mean, np.roll(major_profile, i))[0, 1]
            if major_corr > max_corr:
                max_corr = major_corr
                detected_key = key_names[i]
                detected_mode = 'major'

            # Minor key correlation
            minor_corr = np.corrcoef(chroma_mean, np.roll(minor_profile, i))[0, 1]
            if minor_corr > max_corr:
                max_corr = minor_corr
                detected_key = key_names[i]
                detected_mode = 'minor'

        # Confidence is the max correlation normalized to 0-1
        confidence = max(0, min(1, (max_corr + 1) / 2))

        return detected_key, detected_mode, confidence

    except Exception as e:
        log(f"  Key detection error: {str(e)}")
        return None, None, 0.0


def detect_transients(audio_path, sensitivity=0.5, min_gap_sec=0.5, sr=22050):
    """
    Detect transient points in audio using librosa onset detection.
    Returns list of transient times in milliseconds.
    """
    try:
        # Load audio at reduced sample rate for speed
        y, sr = librosa.load(audio_path, sr=sr)

        # Compute onset strength envelope
        onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=512)

        # Map sensitivity (0-1) to detection parameters
        delta = max(0.01, 0.5 - sensitivity * 0.4)  # Range: 0.1 to 0.5
        wait = int(50 - sensitivity * 40)            # Range: 10 to 50 frames
        pre_avg = int(10 - sensitivity * 8)          # Range: 2 to 10 frames

        # Detect onsets
        onset_times = librosa.onset.onset_detect(
            onset_envelope=onset_env,
            sr=sr,
            units='time',
            backtrack=True,
            normalize=True,
            delta=delta,
            wait=wait,
            pre_avg=pre_avg,
            post_avg=pre_avg,
            pre_max=max(1, pre_avg),
            post_max=max(1, pre_avg)
        )

        # Apply minimum gap debounce
        if len(onset_times) > 0:
            filtered = [onset_times[0]]
            for t in onset_times[1:]:
                if t - filtered[-1] >= min_gap_sec:
                    filtered.append(t)
            onset_times = np.array(filtered)

        # Convert to milliseconds
        onset_times_ms = [int(t * 1000) for t in onset_times]

        log(f"Detected {len(onset_times_ms)} transient points")
        return onset_times_ms

    except Exception as e:
        log(f"Transient detection error: {str(e)}")
        return []


def compute_mfcc_fingerprint(audio_segment, n_mfcc=13):
    """
    Compute MFCC fingerprint for similarity comparison.
    Returns mean MFCC vector for the audio segment.
    """
    try:
        # Convert to numpy array
        samples = np.array(audio_segment.get_array_of_samples()).astype(float)

        # Normalize
        if len(samples) > 0 and np.max(np.abs(samples)) > 0:
            samples = samples / np.max(np.abs(samples))

        # Compute MFCCs
        mfccs = librosa.feature.mfcc(
            y=samples,
            sr=audio_segment.frame_rate,
            n_mfcc=n_mfcc,
            hop_length=512
        )

        # Take mean across time to get fixed-size fingerprint
        fingerprint = np.mean(mfccs, axis=1)

        return fingerprint

    except Exception as e:
        log(f"  MFCC computation error: {str(e)}")
        return None


def cosine_similarity(vec1, vec2):
    """Compute cosine similarity between two vectors."""
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)

    if norm1 == 0 or norm2 == 0:
        return 0.0

    return dot_product / (norm1 * norm2)


def generate_random_name(used_names):
    """Generate a unique random name from adjective + noun + suffix."""
    max_attempts = 100
    for _ in range(max_attempts):
        name = f"{random.choice(ADJECTIVES)}_{random.choice(NOUNS)}_{random.choice(SUFFIXES)}"
        if name not in used_names:
            used_names.add(name)
            return name
    # Fallback with counter to guarantee uniqueness
    base = f"{random.choice(ADJECTIVES)}_{random.choice(NOUNS)}_{random.choice(SUFFIXES)}"
    counter = 1
    while f"{base}_{counter}" in used_names:
        counter += 1
    name = f"{base}_{counter}"
    used_names.add(name)
    return name


def group_similar_samples(sample_data, threshold=0.85, max_distance=15):
    """
    Group similar samples based on MFCC fingerprints.
    Only compares samples within max_distance positions (locality-aware).
    This prevents grouping the entire file when samples are similar throughout.

    Returns list of groups where each group is a list of (index, filepath, fingerprint) tuples.
    """
    groups = []
    used = set()

    for i, (fp1, path1, _) in enumerate(sample_data):
        if i in used or fp1 is None:
            continue

        group = [(i, path1, fp1)]
        used.add(i)

        # Only check nearby samples (within max_distance)
        start_idx = max(0, i - max_distance)
        end_idx = min(len(sample_data), i + max_distance + 1)

        for j in range(start_idx, end_idx):
            if j <= i or j in used:
                continue

            fp2, path2, _ = sample_data[j]
            if fp2 is None:
                continue

            similarity = cosine_similarity(fp1, fp2)

            if similarity >= threshold:
                group.append((j, path2, fp2))
                used.add(j)

        groups.append(group)

    return groups


def rename_with_similarity_groups(output_folder, groups, rr_labeling=False):
    """
    Rename files based on similarity groups.
    Uses RR1, RR2, RR3 (round robin) or a, b, c (alphabetical) suffixes.
    """
    log("")
    label_style = "Round Robin (RR1, RR2, ...)" if rr_labeling else "alphabetical (a, b, c)"
    log(f"=== GROUPING SIMILAR SAMPLES ({label_style}) ===")

    renamed_count = 0

    for group in groups:
        if len(group) <= 1:
            continue  # Skip single samples (not grouped)

        log(f"Group of {len(group)} similar samples:")

        # Use the first sample's base name
        first_idx, first_path, _ = group[0]
        base_name = os.path.basename(first_path).replace('.wav', '')

        # Get base name without existing number suffix
        # E.g., "mudpie_001" -> "mudpie"
        parts = base_name.rsplit('_', 1)
        if len(parts) == 2 and parts[1].isdigit():
            name_base = parts[0]
            base_number = parts[1]
        else:
            name_base = base_name
            base_number = str(first_idx + 1).zfill(3)

        # Rename each file in the group
        for group_idx, (orig_idx, orig_path, _) in enumerate(group):
            if rr_labeling:
                suffix = f"RR{group_idx + 1}"
            else:
                suffix = chr(ord('a') + group_idx)
            new_name = f"{name_base}_{base_number}_{suffix}.wav"
            new_path = os.path.join(output_folder, new_name)

            try:
                os.rename(orig_path, new_path)
                log(f"  {os.path.basename(orig_path)} -> {new_name}")
                renamed_count += 1
            except Exception as e:
                log(f"  Error renaming {orig_path}: {str(e)}")

    log(f"Renamed {renamed_count} files into similarity groups")
    log("")


def process_file(input_file, output_folder, split_mode, enable_key_detection=False, enable_similarity_grouping=False, **kwargs):
    """Process a single audio file"""
    filename = os.path.basename(input_file).replace('.wav', '').replace('.mp3', '').replace('.flac', '')

    # Store sample data for similarity grouping
    sample_data = []  # List of (fingerprint, filepath, chunk_number)

    log(f"Loading: {filename}")

    # Load audio (pydub auto-detects format)
    try:
        if input_file.endswith('.wav'):
            audio = AudioSegment.from_wav(input_file)
        elif input_file.endswith('.mp3'):
            audio = AudioSegment.from_mp3(input_file)
        elif input_file.endswith('.flac'):
            audio = AudioSegment.from_file(input_file, 'flac')
        elif input_file.endswith('.aiff'):
            audio = AudioSegment.from_file(input_file, 'aiff')
        elif input_file.endswith('.m4a'):
            audio = AudioSegment.from_file(input_file, 'm4a')
        else:
            audio = AudioSegment.from_file(input_file)
    except Exception as e:
        log(f"Error loading {filename}: {str(e)}")
        return 0, 0

    # Calculate chunk positions based on mode
    chunk_positions = []

    if split_mode == 'time':
        chunk_length_ms = int(kwargs['time_seconds'] * 1000)
        log(f"Chunk length: {chunk_length_ms}ms")
    elif split_mode == 'bar':
        bpm = kwargs['bpm']
        musical_time = kwargs['musical_time']
        beats = MUSICAL_TIME_MAP.get(musical_time, 4.0)
        chunk_length_ms = int((60000 / bpm) * beats)
        log(f"Chunk length: {chunk_length_ms}ms")
    elif split_mode == 'random':
        random_count = kwargs['random_count']
        min_duration_ms = int(kwargs['random_min_duration'] * 1000)

        # Generate random split points
        total_duration_ms = len(audio)
        max_start = total_duration_ms - (min_duration_ms * random_count)

        if max_start <= 0:
            log(f"Error: Audio too short for {random_count} chunks with minimum duration {kwargs['random_min_duration']}s")
            return 0, 0

        # Create random boundaries ensuring minimum duration
        split_points = sorted([random.randint(0, max_start) for _ in range(random_count - 1)])
        split_points = [0] + split_points + [total_duration_ms]

        # Ensure minimum duration between points
        filtered_points = [split_points[0]]
        for point in split_points[1:]:
            if point - filtered_points[-1] >= min_duration_ms:
                filtered_points.append(point)

        # Store for custom iteration
        chunk_positions = [(filtered_points[i], filtered_points[i+1])
                           for i in range(len(filtered_points)-1)]

        log(f"Generated {len(chunk_positions)} random chunks")
    elif split_mode == 'transient':
        sensitivity = kwargs['transient_sensitivity']
        min_gap = kwargs['transient_min_gap']

        log(f"Detecting transients (sensitivity: {sensitivity})...")
        transient_points = detect_transients(input_file, sensitivity, min_gap)

        if len(transient_points) == 0:
            log("No transients detected. Try increasing sensitivity.")
            return 0, 0

        # Warn if too many chunks detected
        if len(transient_points) > 1000:
            log(f"WARNING: {len(transient_points)} transients detected. Consider reducing sensitivity.")

        # Create chunk positions from transients
        chunk_positions = [(transient_points[i], transient_points[i+1])
                           for i in range(len(transient_points)-1)]

        # Add final chunk from last transient to end
        total_duration_ms = len(audio)
        chunk_positions.append((transient_points[-1], total_duration_ms))

        log(f"Created {len(chunk_positions)} chunks from transients")

    # Get settings
    silence_threshold = kwargs.get('silence_threshold', -50)
    naming_pattern = kwargs.get('naming_pattern', '{filename}_bar_{number:03d}')
    max_samples = kwargs.get('max_samples', 999999)
    processing_delay = kwargs.get('processing_delay', 0)

    exported_count = 0
    skipped_count = 0
    used_random_names = set()

    # Create iterator based on mode
    if split_mode == 'random' or split_mode == 'transient':
        # Random and transient modes use custom chunk positions
        chunks_iterator = ((start_ms, end_ms) for start_ms, end_ms in chunk_positions)
    else:
        # Time and bar modes use regular intervals
        chunks_iterator = ((i, i + chunk_length_ms) for i in range(0, len(audio), chunk_length_ms))

    # Split and export
    for start_ms, end_ms in chunks_iterator:
        # Check if we've hit the sample limit
        if exported_count >= max_samples:
            log(f"Sample limit reached ({max_samples}). Stopping processing.")
            log(f"UPGRADE REQUIRED: Free version limited to {max_samples} samples per session.")
            break

        chunk = audio[start_ms:end_ms]

        # Skip if too quiet
        if chunk.dBFS < silence_threshold:
            skipped_count += 1
            continue

        # Normalize
        chunk = chunk.normalize()

        # Detect key if enabled
        key_label = ""
        if enable_key_detection:
            key, mode, confidence = detect_key(chunk)
            if key and confidence > 0.5:  # Only use if confidence > 50%
                # Format as short notation: "Cm" for C minor, "C" for C major
                key_label = f"{key}m" if mode == 'minor' else key
                log(f"  Detected key: {key} {mode} (confidence: {confidence:.2f})")
            else:
                key_label = "Unknown"
                if confidence > 0:
                    log(f"  Key detection uncertain (confidence: {confidence:.2f})")

        # Generate output filename
        bar_number = exported_count + 1

        # Parse naming pattern
        output_name = naming_pattern
        output_name = output_name.replace('{filename}', filename)
        output_name = output_name.replace('{number:03d}', f'{bar_number:03d}')
        output_name = output_name.replace('{number}', str(bar_number))
        output_name = output_name.replace('{key}', key_label)
        if '{random}' in output_name:
            output_name = output_name.replace('{random}', generate_random_name(used_random_names))

        output_path = os.path.join(output_folder, f"{output_name}.wav")

        # Apply processing delay for free tier (makes it slower)
        if processing_delay > 0:
            time.sleep(processing_delay / 1000.0)  # Convert ms to seconds

        # Export at 24-bit
        chunk.export(
            output_path,
            format="wav",
            parameters=["-acodec", "pcm_s24le"]
        )
        exported_count += 1

        # Compute fingerprint for similarity grouping
        if enable_similarity_grouping:
            fingerprint = compute_mfcc_fingerprint(chunk)
            sample_data.append((fingerprint, output_path, bar_number))

    log(f"{filename}: Exported {exported_count}, Skipped {skipped_count}")

    # Group similar samples if enabled
    if enable_similarity_grouping and len(sample_data) > 1:
        similarity_threshold = kwargs.get('similarity_threshold', 0.85)
        log(f"Analyzing {len(sample_data)} samples for similarity (threshold: {similarity_threshold})...")

        groups = group_similar_samples(sample_data, similarity_threshold)

        # Count how many groups have multiple samples
        multi_sample_groups = [g for g in groups if len(g) > 1]
        if len(multi_sample_groups) > 0:
            log(f"Found {len(multi_sample_groups)} groups with similar samples")
            rr_labeling = kwargs.get('rr_labeling', False)
            rename_with_similarity_groups(output_folder, groups, rr_labeling=rr_labeling)
        else:
            log("No similar samples found")

    return exported_count, skipped_count


def main():
    parser = argparse.ArgumentParser(description='Split audio files into chunks')
    parser.add_argument('--input', required=True, help='JSON array of input file paths')
    parser.add_argument('--output', required=True, help='Output folder path')
    parser.add_argument('--mode', required=True, choices=['time', 'bar', 'random', 'transient'], help='Split mode')
    parser.add_argument('--time', type=float, help='Time in seconds (for time mode)')
    parser.add_argument('--bpm', type=int, help='BPM (for bar mode)')
    parser.add_argument('--musical-time', type=str, help='Musical time division (e.g., "1/4", "2")')
    parser.add_argument('--random-count', type=int, help='Number of random chunks')
    parser.add_argument('--random-min-duration', type=float, default=0.5, help='Min chunk duration in seconds')
    parser.add_argument('--transient-sensitivity', type=float, default=0.5, help='Transient sensitivity (0.0-1.0)')
    parser.add_argument('--transient-min-gap', type=float, default=0.5, help='Minimum gap between transients in seconds')
    parser.add_argument('--naming', default='{filename}_bar_{number:03d}', help='Naming pattern')
    parser.add_argument('--threshold', type=float, default=-50, help='Silence threshold in dBFS')
    parser.add_argument('--max-samples', type=int, default=999999, help='Maximum samples to export')
    parser.add_argument('--delay', type=int, default=0, help='Processing delay in milliseconds')
    parser.add_argument('--enable-key-detection', action='store_true', help='Enable musical key detection')
    parser.add_argument('--enable-similarity-grouping', action='store_true', help='Group similar samples')
    parser.add_argument('--similarity-threshold', type=float, default=0.85, help='Similarity threshold (0.0-1.0)')
    parser.add_argument('--rr-labeling', action='store_true', help='Use RR1, RR2, RR3 for similarity groups')

    args = parser.parse_args()

    # Parse input files from JSON
    input_files = json.loads(args.input)

    # Create output folder if needed
    os.makedirs(args.output, exist_ok=True)

    log(f"Processing {len(input_files)} file(s)")
    log(f"Output: {args.output}")

    total_exported = 0
    total_skipped = 0

    # Process each file
    for input_file in input_files:
        # Check if we've hit the global sample limit
        remaining_samples = args.max_samples - total_exported
        if remaining_samples <= 0:
            log("Sample limit reached. Stopping batch processing.")
            break

        kwargs = {
            'silence_threshold': args.threshold,
            'naming_pattern': args.naming,
            'max_samples': remaining_samples,
            'processing_delay': args.delay,
            'similarity_threshold': args.similarity_threshold,
            'rr_labeling': args.rr_labeling,
        }

        if args.mode == 'time':
            kwargs['time_seconds'] = args.time
        elif args.mode == 'bar':
            kwargs['bpm'] = args.bpm
            kwargs['musical_time'] = args.musical_time
        elif args.mode == 'random':
            kwargs['random_count'] = args.random_count
            kwargs['random_min_duration'] = args.random_min_duration
        elif args.mode == 'transient':
            kwargs['transient_sensitivity'] = args.transient_sensitivity
            kwargs['transient_min_gap'] = args.transient_min_gap

        exported, skipped = process_file(input_file, args.output, args.mode, args.enable_key_detection, args.enable_similarity_grouping, **kwargs)
        total_exported += exported
        total_skipped += skipped

    log("")
    log(f"=== COMPLETE ===")
    log(f"Total exported: {total_exported}")
    log(f"Total skipped: {total_skipped}")
    log(f"Output location: {args.output}")


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        log(f"ERROR: {str(e)}")
        sys.exit(1)
