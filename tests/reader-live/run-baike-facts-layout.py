"""Run the Baidu facts fixture or inspect the current visible Baidu article."""
import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--session", default="baike-manual", help="named Playwright CLI session with the source extension loaded")
parser.add_argument("--mode", choices=("fixture", "live"), default="fixture")
args = parser.parse_args()

root = Path(__file__).resolve().parents[2]
wrapper = Path.home() / ".codex/skills/playwright/scripts/playwright_cli.sh"
script_name = "baike-facts.js" if args.mode == "fixture" else "baike-facts-layout-live.js"
code = (root / "tests/reader-live" / script_name).read_text()
run = subprocess.run([str(wrapper), "-s=" + args.session, "run-code", code], capture_output=True, text=True, timeout=180)
output = run.stdout + run.stderr
marker = "### Result\n"
if marker not in output:
    print(output[:3000])
    raise SystemExit(run.returncode or 1)

payload = output.split(marker, 1)[1].split("\n###", 1)[0]
try:
    result = json.loads(payload)
except json.JSONDecodeError:
    print(output[:3000])
    raise SystemExit(1)

if args.mode == "fixture":
    summary = {
        "mode": "fixture",
        "source": result["source"],
        "narrow": {"contentWidth": result["narrow"]["factLayout"]["contentWidth"], "display": result["narrow"]["factLayout"]["display"], "rows": len(result["narrow"]["rows"])},
        "wide": {"contentWidth": result["wide"]["factLayout"]["contentWidth"], "display": result["wide"]["factLayout"]["display"], "columns": result["wide"]["factLayout"]["columns"], "rows": len(result["wide"]["rows"])},
        "translation": result["translation"]
    }
    valid = summary["narrow"]["display"] != "grid" and summary["wide"]["display"] == "grid" and summary["wide"]["columns"] == 2
else:
    summary = result
    valid = result["narrow"]["display"] != "grid" and result["wide"]["display"] == "grid" and result["wide"]["columns"] == 2 and result["wide"]["rows"] == result["narrow"]["rows"]

print(json.dumps(summary, ensure_ascii=False, indent=2))
if run.returncode or not valid:
    raise SystemExit(1)
