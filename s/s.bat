echo off

set EASYCHESS_DEV=1

call firebase\makeenv

\node\node resources\server\server.js
