"""Generate the optimized WebP sprites in public/images/optimized/ from assets/sprites/.

Usage:
  python scripts/optimize-sprites.py            # convert new or changed sprites only
  python scripts/optimize-sprites.py --force    # rebuild everything
  python scripts/optimize-sprites.py --check    # verify outputs are up to date (no Pillow needed)
  python scripts/optimize-sprites.py --scale 0.4 --quality 90 --lossless

The Photoshop exports in assets/sprites/ are never modified. See sprite_optimize.py
for details. Options other than the defaults are meant for experiments: the next run
without them rebuilds everything with the default settings.
"""
import argparse
import sys

import sprite_optimize as optimizer


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--scale", type=float, default=optimizer.DEFAULT_SCALE,
                        help="output size relative to the exports (default: %(default)s)")
    parser.add_argument("--quality", type=int, default=optimizer.DEFAULT_QUALITY,
                        help="WebP quality 0-100 (default: %(default)s)")
    parser.add_argument("--lossless", action="store_true", help="lossless WebP (much larger files)")
    parser.add_argument("--force", action="store_true", help="rebuild every sprite")
    parser.add_argument("--jobs", type=int, help="parallel workers (default: up to 4)")
    parser.add_argument("--check", action="store_true", help="only verify that outputs are up to date")
    args = parser.parse_args()

    if args.check:
        problems = optimizer.check()
        if problems:
            print("\n".join(problems), file=sys.stderr)
            print("\nRun: python scripts/optimize-sprites.py", file=sys.stderr)
            sys.exit(1)
        print("public/images/optimized/ is up to date.")
        return

    if not 0 < args.scale <= 1:
        parser.error("--scale must be between 0 (excluded) and 1")
    ok = optimizer.optimize_all(args.scale, args.quality, args.lossless, args.force, args.jobs)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
