#!/bin/sh
# Build the plugin and install it, plus the vault settings the site expects,
# into a vault. Default vault: the Mac clone's src/content (reachable from the
# MateBook over the SSHFS mapping of /Users/raymond).
#   tools/obsidian-blog/install.sh [vault-dir]
# Re-running only overwrites the plugin files; existing app.json keys are merged.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
vault=${1:-/Users/raymond/Documents/kirisawa-blog/src/content}
cd "$here"
[ -d node_modules ] || npm ci --silent
npm run --silent build
dest="$vault/.obsidian/plugins/kirisawa-blog"
mkdir -p "$dest"
cp dist/main.js manifest.json styles.css "$dest/"
python3 - "$vault/.obsidian" <<'PY'
import json, pathlib, sys
cfg = pathlib.Path(sys.argv[1])
def merge(name, values):
    p = cfg / name
    data = json.loads(p.read_text()) if p.exists() else {}
    data.update(values)
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
# Markdown links (the site does not understand [[wikilinks]]), attachments
# beside the post in ./assets, new notes in posts/.
merge("app.json", {
    "useMarkdownLinks": True,
    "newLinkFormat": "relative",
    "attachmentFolderPath": "./assets",
    "alwaysUpdateLinks": True,
    "newFileLocation": "folder",
    "newFileFolderPath": "posts",
    "showUnsupportedFiles": False,
})
p = cfg / "community-plugins.json"
plugins = json.loads(p.read_text()) if p.exists() else []
if "kirisawa-blog" not in plugins:
    plugins.append("kirisawa-blog")
p.write_text(json.dumps(plugins) + "\n")
PY
echo "installed into $dest"
