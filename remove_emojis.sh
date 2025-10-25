#!/bin/bash
for file in *.md; do
  if [ -f "$file" ]; then
    sed -i 's/🎯/[TARGET]/g; s/✅/[COMPLETE]/g; s/⚠️/[WARNING]/g; s/🔧/[FIX]/g; s/🔐/[SECURITY]/g; s/📚/[DOCS]/g; s/🧪/[TEST]/g; s/🚀/[DEPLOY]/g; s/🎓/[GUIDE]/g; s/🏆/[SUCCESS]/g; s/🎉/[DONE]/g; s/❌/[REMOVED]/g; s/📊/[DATA]/g; s/🔍/[AUDIT]/g; s/🏗️/[ARCH]/g; s/🔒/[ENCRYPT]/g; s/⛓️/[CHAIN]/g' "$file"
    echo "Processed: $file"
  fi
done
