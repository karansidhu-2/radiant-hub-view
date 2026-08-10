/**
 * Per-icon deep imports (`lucide-react/dist/esm/icons/<kebab-name>`) keep the
 * icon barrel out of the module graph so each route chunk only carries the
 * icons it renders. lucide-react ships no per-file `.d.ts`, so declare the
 * shape once here — every icon module default-exports a LucideIcon.
 */
declare module "lucide-react/dist/esm/icons/*" {
  const icon: import("lucide-react").LucideIcon;
  export default icon;
}
