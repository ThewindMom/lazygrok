#!/usr/bin/env bash
set -euo pipefail

grok_home="${GROK_HOME:-${HOME}/.grok}"
hooks_dir="${grok_home}/hooks"
archive_root="${grok_home}/archive"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive_dir="${archive_root}/removed-global-lazygrok-${stamp}"
archived=0

for name in lazygrok.json lazygrok-run.sh; do
  source_path="${hooks_dir}/${name}"
  if [[ ! -e "${source_path}" && ! -L "${source_path}" ]]; then
    continue
  fi
  if [[ "${archived}" -eq 0 ]]; then
    mkdir -p "${archive_dir}"
    chmod 700 "${archive_root}" "${archive_dir}"
  fi
  mv -- "${source_path}" "${archive_dir}/${name}"
  chmod 600 "${archive_dir}/${name}"
  archived=$((archived + 1))
done

if [[ "${archived}" -eq 0 ]]; then
  echo "No LazyGrok user-hook bridge files found under ${hooks_dir}."
else
  echo "Archived ${archived} LazyGrok user-hook bridge file(s) under ${archive_dir}."
fi
