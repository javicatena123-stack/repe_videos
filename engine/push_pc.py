#!/usr/bin/env python3
"""Sube archivos al repo público repe_videos (GitHub) y devuelve sus URLs raw para Metricool. Se ejecuta en el PC.

  python3 push_pc.py "mensaje" origen1 destino1 [origen2 destino2 ...]

El token está en  Videos/Munster Gym/.repe/gh_token  (nunca se escribe en el repo ni se imprime).
"""
import os, sys, shutil, subprocess, urllib.request

REPO = "javicatena123-stack/repe_videos"
HERE = os.path.dirname(os.path.abspath(__file__))
TOKEN = open(os.path.join(HERE, "..", "..", ".repe", "gh_token")).read().strip()
WORK = os.path.expanduser("~/repo")
GIT = ["git", "-c", "user.name=repe-bot", "-c", "user.email=repe-bot@users.noreply.github.com"]


def run(cmd, cwd=None):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit((r.stdout + r.stderr).replace(TOKEN, "***")[-800:])
    return r.stdout


def main():
    msg, pairs = sys.argv[1], sys.argv[2:]
    url = f"https://x-access-token:{TOKEN}@github.com/{REPO}.git"
    if not os.path.isdir(os.path.join(WORK, ".git")):
        run(["git", "clone", "-q", url, WORK])
    else:
        run(["git", "remote", "set-url", "origin", url], WORK)
        run(GIT + ["pull", "-q", "--rebase", "origin", "main"], WORK)
    for src, dst in zip(pairs[::2], pairs[1::2]):
        d = os.path.join(WORK, dst)
        os.makedirs(os.path.dirname(d), exist_ok=True)
        if os.path.isdir(src):
            shutil.copytree(src, d, dirs_exist_ok=True, ignore=shutil.ignore_patterns("__pycache__", "*.tmp.mp4"))
        else:
            shutil.copy2(src, d)
    run(GIT + ["add", "-A"], WORK)
    if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=WORK).returncode != 0:
        run(GIT + ["commit", "-qm", msg], WORK)
        run(["git", "push", "-q", "origin", "main"], WORK)
    for dst in pairs[1::2]:
        raw = f"https://raw.githubusercontent.com/{REPO}/main/{dst}"
        try:
            code = urllib.request.urlopen(urllib.request.Request(raw, method="HEAD"), timeout=30).status
        except Exception as e:
            code = getattr(e, "code", str(e))
        print(code, raw)


if __name__ == "__main__":
    main()
