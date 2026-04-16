import type { RuleConfigState, RuleEntry, RuleLevel } from "./types";

export function isRuleConfigured(
    states: RuleConfigState[] | undefined
): boolean {
    return (states?.length ?? 0) > 0;
}

export function isRuleEnabled(states: RuleConfigState[] | undefined): boolean {
    if (!states?.length) return false;

    return states.some((state) => state.level !== "off");
}

function toRulePrimaryValue(level: RuleEntry | undefined): unknown {
    return Array.isArray(level) ? level[0] : level;
}

function isDisabledRuleValue(value: unknown): boolean {
    return (
        value === undefined ||
        value === null ||
        value === false ||
        value === 0 ||
        value === "off"
    );
}

export function getRulePrimaryOption(level: RuleEntry | undefined): unknown {
    const primary = toRulePrimaryValue(level);
    return isDisabledRuleValue(primary) ? undefined : primary;
}

export function getRuleLevel(level: RuleEntry | undefined): RuleLevel {
    const first = Array.isArray(level) ? level[0] : level;

    if (first === undefined) return "off";

    // Stylelint: `null` disables a rule
    if (first === null) return "off";

    if (Array.isArray(level)) {
        const second = level[1];
        if (
            second &&
            typeof second === "object" &&
            !Array.isArray(second) &&
            "severity" in second &&
            second.severity === "warning"
        ) {
            return "warn";
        }
    }

    switch (first) {
        case 0:
        case "off":
        case false:
            return "off";
        case 1:
        case "warn":
        case "warning":
            return "warn";
        case 2:
        case "error":
            return "error";
        default:
            // Stylelint and similar config systems treat non-null primary values as enabled.
            return "error";
    }
}

export function getRuleOptions(
    level: RuleEntry | undefined
): unknown[] | undefined {
    if (Array.isArray(level)) return level.slice(1);
}
