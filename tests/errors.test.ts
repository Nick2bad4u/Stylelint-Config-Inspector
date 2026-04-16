import { afterEach, describe, expect, it, vi } from "vitest";
import { MARK_ERROR } from "../src/constants";
import {
    ConfigInspectorError,
    ConfigPathError,
    ConfigPathLegacyError,
} from "../src/errors";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("config inspector errors", () => {
    it("prints base inspector errors with mark and message", () => {
        const spy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        const error = new ConfigInspectorError("Something failed");

        error.prettyPrint();

        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(MARK_ERROR, "Something failed");
    });

    it("prints config path guidance including base path and candidate filenames", () => {
        const spy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        const error = new ConfigPathError("/repo", [
            "stylelint.config.js",
            "stylelint.config.mjs",
        ]);

        error.prettyPrint();

        expect(error.name).toBe("ConfigPathError");
        expect(spy).toHaveBeenCalledTimes(1);

        const [
            mark,
            headline,
            details,
        ] = spy.mock.calls[0] ?? [];
        expect(mark).toBe(MARK_ERROR);
        expect(headline).toBe("Cannot find Stylelint config file");
        expect(typeof details).toBe("string");
        expect(details).toContain("/repo");
        expect(details).toContain("stylelint.config.js");
        expect(details).toContain("stylelint.config.mjs");
    });

    it("prints legacy config migration guidance with filename and docs URL", () => {
        const spy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        const error = new ConfigPathLegacyError("/repo", ".stylelintrc");

        error.prettyPrint();

        expect(error.name).toBe("ConfigPathLegacyError");
        expect(spy).toHaveBeenCalledTimes(1);

        const [
            mark,
            headline,
            details,
        ] = spy.mock.calls[0] ?? [];
        expect(mark).toBe(MARK_ERROR);
        expect(headline).toBe("Found legacy Stylelint config file");
        expect(typeof details).toBe("string");
        expect(details).toContain(".stylelintrc");
        expect(details).toContain("/repo");
        expect(details).toContain("https://stylelint.io/user-guide/configure");
    });
});
