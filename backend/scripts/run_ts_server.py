import sys, os, json
os.chdir(os.path.dirname(__file__))

# Write a marker to confirm this script runs
with open(os.path.join(os.path.dirname(__file__), 'server_started.txt'), 'w') as f:
    f.write('started')

import uvicorn
uvicorn.run("main:app", host="127.0.0.1", port=8000)
