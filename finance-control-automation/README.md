# Daily Finance Control Automation (fictional company)

Design and reference implementation of a daily finance control for **Cedar Ridge Supply Co.**, a fictional company. All data, names and addresses are invented.

> **Status:** Designed and tested locally only. **Nothing is scheduled, no trigger is live, and no notifications are sent.** See [DESIGN.md §0](DESIGN.md#0-what-is-real-today-and-what-isnt) and the go-live gates in §15.

| Path | What it is |
|---|---|
| [`DESIGN.md`](DESIGN.md) | Full specification: platform, integrations, permissions, deployment, Claude-vs-scripts-vs-services split |
| `config/control_config.json` | Trigger, schemas, rule thresholds, routing, retries |
| `src/daily_control.py` | Runner (Python standard library only) |
| `sample_data/2026-10-09/` | Fictional input files + manifest |
| `examples/sample_run/` | Outputs from a first run and an idempotent rerun of the sample |
| `tests/` | Unit tests |

## Run locally

```bash
cd finance-control-automation
python3 -m unittest discover -s tests -v

python3 src/daily_control.py run \
  --config config/control_config.json \
  --business-date 2026-10-09 \
  --input-dir sample_data/2026-10-09 \
  --output-dir out --state-dir state --log-dir logs
```

Run it a second time and the log shows `DUPLICATE_BATCH_SKIPPED`. Add `--reprocess` to recompute; no reviewer is notified twice and no action is queued twice.

Exit codes: `0` ok/skipped · `1` run error · `2` validation failed · `3` lock held · `4` file-arrival marker not present.
