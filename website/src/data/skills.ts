/**
 * Skill → colour binding. Single source of truth.
 *
 * Hue primitives live in src/styles/global.css under @theme.
 * This file maps each skill name to one of those hues. Adding a new
 * skill means adding one line here (and a new hue in @theme if none
 * of the existing ones fit).
 */
export const SKILLS = {
  talk: { color: "var(--color-cyan)" },
  do: { color: "var(--color-magenta)" },
  hickey: { color: "var(--color-lime)" },
  lowy: { color: "var(--color-orange)" },
  "code-police": { color: "var(--color-iris)" },
} as const satisfies Record<string, { color: string }>;

export type SkillName = keyof typeof SKILLS;
