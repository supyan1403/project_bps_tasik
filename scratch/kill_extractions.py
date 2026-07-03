import os
import subprocess
import re

# Get tasklist output with command line arguments (using wmic process get processid,commandline)
try:
    print("Finding and killing python extraction processes...")
    output = subprocess.check_output('wmic process get processid,commandline', shell=True).decode('utf-8', errors='ignore')
    
    lines = output.split('\n')
    killed = 0
    for line in lines:
        if not line.strip():
            continue
        # Search for python.exe running pdf_table_pipeline.py or extract_toc.py
        if ('python' in line.lower() and ('pdf_table_pipeline.py' in line or 'extract_toc.py' in line)):
            # Find the process ID at the end of the line
            parts = line.strip().split()
            if parts:
                pid = parts[-1]
                if pid.isdigit():
                    print(f"Killing process {pid} with command line: {' '.join(parts[:-1])}")
                    os.system(f"taskkill /F /PID {pid}")
                    killed += 1
    print(f"Finished. Killed {killed} processes.")
except Exception as e:
    print(f"Error: {e}")
