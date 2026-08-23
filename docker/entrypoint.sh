#!/bin/sh
set -e
if [ -f apps/erp-admin/server.js ]; then
  exec node apps/erp-admin/server.js
elif [ -f apps/vitrine/server.js ]; then
  exec node apps/vitrine/server.js
else
  exec node server.js
fi