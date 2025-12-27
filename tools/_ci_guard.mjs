export function enforceCIGuard(argv = process.argv, env = process.env) {
  const forced = argv.includes("--force");
  const inCI = env.CI === "1" || env.CI === "true";
  if (!inCI && !forced) {
    console.log("[SKIP] CI guard active. Set CI=1 or pass --force to run.");
    process.exit(0);
  }
  return { forced, inCI };
}
