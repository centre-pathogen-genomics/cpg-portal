#!/bin/sh
# Prerender the public tool pages in the background: nginx must not wait for the
# API, and the pages are rewritten from the current catalogue on every pass.
set -u

if [ "${PRERENDER_ENABLED:-true}" != "true" ]; then
    echo "prerender: disabled"
    exit 0
fi

/usr/local/bin/prerender.py &
echo "prerender: started"
