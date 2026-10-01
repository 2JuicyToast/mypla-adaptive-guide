import { Check } from "lucide-react";

type PasswordRule = {
  label: string;
  met: boolean;
};

export function PasswordStrengthMeter({ password }: { password: string }) {
  const rules: PasswordRule[] = [
    { label: "At least 8 characters", met: password.length >= 8 },
    {
      label: "Uppercase and lowercase letters",
      met: /[a-z]/.test(password) && /[A-Z]/.test(password),
    },
    { label: "A number", met: /\d/.test(password) },
    { label: "A symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];

  const score = rules.filter((rule) => rule.met).length;
  const strength =
    password.length === 0
      ? "Not set"
      : password.length < 8 || score <= 1
        ? "Weak"
        : score === 2
          ? "Fair"
          : score === 3
            ? "Good"
            : "Strong";
  const level =
    strength === "Not set" ? 0 : strength === "Weak" ? 1 : strength === "Fair" ? 2 : score;

  const strengthColor =
    strength === "Weak"
      ? "text-destructive"
      : strength === "Fair"
        ? "text-amber-700"
        : strength === "Good"
          ? "text-sky-700"
          : strength === "Strong"
            ? "text-emerald-700"
            : "text-muted-foreground";
  const meterColor =
    strength === "Weak"
      ? "bg-destructive"
      : strength === "Fair"
        ? "bg-amber-500"
        : strength === "Good"
          ? "bg-sky-500"
          : "bg-emerald-500";

  return (
    <div id="mypla-password-strength" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Password strength</span>
        <span aria-live="polite" className={`text-xs font-semibold ${strengthColor}`}>
          {strength}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={level}
        aria-valuetext={strength}
        className="flex gap-1"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${
              index < level ? meterColor : "bg-muted"
            }`}
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        {rules.map((rule) => (
          <li key={rule.label} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`grid size-3.5 place-items-center rounded-full ${
                rule.met ? "bg-emerald-100 text-emerald-700" : "border border-border"
              }`}
            >
              {rule.met ? <Check className="size-2.5" strokeWidth={3} /> : null}
            </span>
            {rule.label}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        This is a local estimate, not a guarantee of account security.
      </p>
    </div>
  );
}