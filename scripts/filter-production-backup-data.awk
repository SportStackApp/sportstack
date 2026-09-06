# Keep application data for isolated rehearsals while omitting managed Auth
# and Storage rows whose service-owned schemas vary by local image version.
# The original backup remains unchanged and is always mounted read-only.

/^COPY "(auth|storage)"\./ {
  skip_managed_copy = 1
  next
}

skip_managed_copy && /^\\\.$/ {
  skip_managed_copy = 0
  next
}

skip_managed_copy {
  next
}

/^SELECT pg_catalog\.setval\('\"(auth|storage)\"\./ {
  next
}

{
  print
}
