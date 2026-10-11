/** The one hard rule, enforced on both sides; everything else is advice. */
export const MIN_PASSWORD_LENGTH = 8;
const STRONG_LENGTH = 12;

export interface PasswordCheck {
  id: string;
  label: string;
  met: boolean;
  /** Required checks block registration; the rest only raise the strength. */
  required: boolean;
}

export type PasswordStrength = "too-short" | "weak" | "fair" | "good" | "strong";

export const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  "too-short": "Too short",
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

export function checkPassword(password: string, email: string): PasswordCheck[] {
  const local = email.split("@")[0]?.trim().toLowerCase() ?? "";
  return [
    { id: "length", label: `At least ${MIN_PASSWORD_LENGTH} characters`, met: password.length >= MIN_PASSWORD_LENGTH, required: true },
    { id: "case", label: "Upper and lower case letters", met: /[a-z]/.test(password) && /[A-Z]/.test(password), required: false },
    { id: "number", label: "A number", met: /\d/.test(password), required: false },
    { id: "symbol", label: "A symbol", met: /[^A-Za-z0-9]/.test(password), required: false },
    { id: "long", label: `${STRONG_LENGTH}+ characters`, met: password.length >= STRONG_LENGTH, required: false },
    {
      id: "email",
      label: "Doesn't contain your email",
      met: local.length < 3 || !password.toLowerCase().includes(local),
      required: false,
    },
  ];
}

export function passwordStrength(checks: readonly PasswordCheck[]): PasswordStrength {
  if (checks.some((c) => c.required && !c.met)) return "too-short";
  if (!checks.find((c) => c.id === "email")?.met) return "weak";
  const extras = checks.filter((c) => !c.required && c.id !== "email" && c.met).length;
  return extras <= 1 ? "weak" : extras === 2 ? "fair" : extras === 3 ? "good" : "strong";
}
