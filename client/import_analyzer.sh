#!/bin/bash

# Get all tsx/ts files
find . -type f \( -name "*.tsx" -o -name "*.ts" \) | sed 's|^\./||' | sort > /tmp/all_files.txt

# For each file, find what other files import it
while IFS= read -r file; do
    # Extract just the filename without extension for searching
    basename_no_ext="${file%.*}"
    filename=$(basename "$file")
    filename_no_ext="${filename%.*}"
    
    # Search for imports of this file in all other files
    imports=$(grep -r "from ['\"]@/\|from ['\"]\./" --include="*.tsx" --include="*.ts" . 2>/dev/null | grep -E "(from ['\"].*${filename_no_ext}['\"]|import.*['\"].*${filename_no_ext}['\"])" | cut -d: -f1 | sort -u)
    
    if [ -n "$imports" ]; then
        echo "USED: $file"
        echo "$imports" | sed 's|^\./|  <- |'
    else
        echo "NOT_USED: $file"
    fi
done < /tmp/all_files.txt
