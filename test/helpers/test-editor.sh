#!/bin/sh
# Append a harmless comment so the edit command detects a file change.
echo "# edited in test" >> "$1"
