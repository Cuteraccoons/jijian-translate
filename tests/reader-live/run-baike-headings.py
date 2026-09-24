"""Run Baidu outline checks in an existing visible Playwright CLI browser."""
import argparse
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--session", default="baike-manual", help="named Playwright CLI session with the source extension loaded")
parser.add_argument("--mode", choices=("fixture", "live"), default="fixture")
parser.add_argument("--wait-for-manual", action="store_true", help="wait up to 120 seconds per live page so you can solve Baidu's visible verification")
parser.add_argument("--names", help="comma-separated live sample names to run, for example 周杰伦,民法典")
args = parser.parse_args()

root = Path(__file__).resolve().parents[2]
wrapper = Path.home() / ".codex/skills/playwright/scripts/playwright_cli.sh"
script_name = "baike-headings.js" if args.mode == "fixture" else "baike-headings-live.js"
code = (root / "tests/reader-live" / script_name).read_text()
if args.wait_for_manual:
    if args.mode != "live":
        parser.error("--wait-for-manual applies only to --mode live")
    code = code.replace("const manualVerificationWaitMs = 0;", "const manualVerificationWaitMs = 120000;")
if args.names:
    if args.mode != "live":
        parser.error("--names applies only to --mode live")
    names = [name.strip() for name in args.names.split(",") if name.strip()]
    code = code.replace("for (const sample of samples) {", f"for (const sample of samples.filter(sample => {json.dumps(names, ensure_ascii=False)}.includes(sample.name))) {{")

run = subprocess.run([str(wrapper), "-s=" + args.session, "run-code", code], capture_output=True, text=True, timeout=600)
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
        "assertions": result["assertions"],
        "sourceHeadingCount": len(result["source"]["headings"]),
        "readerHeadingCount": len(result["initial"]["outline"]),
        "clicks": [{"text": item["label"], "occurrence": item["occurrence"], "targetId": item["targetId"], "passed": item["passed"]} for item in result["clickChecks"]],
        "wrapperAnchor": result["wrapperAnchor"],
        "wideEndClick": result["wideEndClick"],
        "translation": result["translation"]
    }
else:
    summary = {
        "mode": "live",
        "waitForManualVerification": args.wait_for_manual,
        "results": [{
            "name": item["name"],
            "status": item["status"],
            "available": item["available"],
            "manualVerified": item.get("manualVerified", False),
            "reusedCurrentPage": item.get("reusedCurrentPage", False),
            "sourceHeadings": item.get("source", {}).get("headingCount"),
            "readerHeadings": item.get("reader", {}).get("headingCount"),
            "sourceLevels": item.get("source", {}).get("headingLevels"),
            "readerLevels": item.get("reader", {}).get("headingLevels"),
            "tocLinks": item.get("source", {}).get("tocLinkCount"),
            "unresolvedTocLinks": item.get("source", {}).get("unresolvedTocLinks"),
            "mismatches": item.get("mismatches", []),
            "clickChecks": item.get("clickChecks", []),
            "reason": item.get("reason")
        } for item in result["results"]]
    }

print(json.dumps(summary, ensure_ascii=False, indent=2))
if run.returncode:
    raise SystemExit(run.returncode)
if args.mode == "fixture" and not all(summary["assertions"].values()):
    raise SystemExit(1)
