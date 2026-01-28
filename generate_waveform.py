#!/usr/bin/env python3
"""
Generate waveform data files for peaks.js visualization.
Uses audiowaveform CLI to create lightweight .dat files.
"""

import subprocess
import os
import sys


def generate_waveform_data(audio_path, output_path=None, pixels_per_second=20, bits=8):
    """
    Generate waveform data using audiowaveform CLI.
    
    Args:
        audio_path: Path to input audio file
        output_path: Path for output .dat file (optional, defaults to same name with .dat extension)
        pixels_per_second: Detail level (higher = more detail, larger file)
        bits: Bit depth (8 or 16, 8 recommended for smaller files)
    
    Returns:
        Path to generated .dat file, or None if failed
    """
    if output_path is None:
        base = os.path.splitext(audio_path)[0]
        output_path = f"{base}.dat"
    
    print(f"Input file: {audio_path}", file=sys.stderr)
    print(f"Output file: {output_path}", file=sys.stderr)
    print(f"Checking if input exists: {os.path.exists(audio_path)}", file=sys.stderr)
    
    try:
        # Run audiowaveform
        cmd = [
            'audiowaveform',
            '-i', audio_path,
            '-o', output_path,
            '--pixels-per-second', str(pixels_per_second),
            '--bits', str(bits)
        ]
        
        print(f"Running command: {' '.join(cmd)}", file=sys.stderr)
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        print(f"Command stdout: {result.stdout}", file=sys.stderr)
        print(f"Command stderr: {result.stderr}", file=sys.stderr)
        
        # Verify output file was created
        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path)
            print(f"✓ Generated waveform data: {output_path} ({file_size} bytes)", file=sys.stderr)
            return output_path
        else:
            print(f"✗ Output file was not created: {output_path}", file=sys.stderr)
            return None
            
    except subprocess.CalledProcessError as e:
        print(f"✗ audiowaveform error:", file=sys.stderr)
        print(f"  Return code: {e.returncode}", file=sys.stderr)
        print(f"  Stdout: {e.stdout}", file=sys.stderr)
        print(f"  Stderr: {e.stderr}", file=sys.stderr)
        return None
    except FileNotFoundError:
        print(f"✗ audiowaveform not found. Install with: brew install audiowaveform", file=sys.stderr)
        return None
    except Exception as e:
        print(f"✗ Waveform generation error: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return None


if __name__ == '__main__':
    # Test mode
    if len(sys.argv) < 2:
        print("Usage: python generate_waveform.py <audio_file> [output_file]")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    print(f"Starting waveform generation...", file=sys.stderr)
    result = generate_waveform_data(audio_file, output_file)
    
    if result:
        print(f"Success! Waveform data saved to: {result}")
        sys.exit(0)
    else:
        print("Failed to generate waveform data")
        sys.exit(1)