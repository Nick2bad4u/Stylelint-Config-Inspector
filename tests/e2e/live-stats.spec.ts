import type { Buffer } from "node:buffer";
import type { ChildProcess } from "node:child_process";
import type { StatsState } from "../../shared/stats";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { getPort } from "get-port-please";
import { lookup } from "mrmime";

const execute = promisify(execFile);
const repository = process.cwd();
const cli = resolve(repository, "bin.mjs");
const css = "a { color: #ffffff; }\n";

async function createWorkspace(): Promise<string> {
    const workspace = await mkdtemp(join(tmpdir(), "stylelint-stats-browser-"));
    await symlink(
        join(repository, "node_modules"),
        join(workspace, "node_modules"),
        "junction"
    );
    await writeFile(join(workspace, "example.css"), css);
    await writeFile(
        join(workspace, ".stylelintcache"),
        "preserve existing cache"
    );
    await writeFile(
        join(workspace, "plugin.mjs"),
        `import stylelint from 'stylelint';
const rule = () => () => {};
rule.ruleName = 'fixture/measured-rule';
export default stylelint.createPlugin(rule.ruleName, rule);
`
    );
    await writeFile(
        join(workspace, "stylelint.config.mjs"),
        `export default {
fix: true, cache: true, plugins: ['./plugin.mjs'],
rules: { 'color-hex-length': 'short', 'fixture/measured-rule': true }
};`
    );
    return workspace;
}

async function stop(child: ChildProcess): Promise<void> {
    if (child.exitCode === null && child.signalCode === null) {
        const stopped = once(child, "exit");
        child.kill();
        await stopped;
    }
}

test("packaged live analysis profiles real Stylelint without modifying project files", async ({
    page,
    request,
}) => {
    test.setTimeout(90_000);
    const workspace = await createWorkspace();
    // Separate browser workers must not race over getPort's shared default port.
    const port = await getPort({ random: true, host: "127.0.0.1" });
    const origin = `http://127.0.0.1:${port}`;
    const child = spawn(
        process.execPath,
        [
            cli,
            "--no-open",
            "--port",
            String(port),
            "--no-files",
        ],
        { cwd: workspace, windowsHide: true, stdio: "pipe" }
    );
    let logs = "";
    child.stdout?.on("data", (chunk: Buffer) => {
        logs += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
        logs += chunk.toString();
    });
    try {
        await expect
            .poll(
                async () => {
                    if (child.exitCode !== null) throw new Error(logs);
                    return request.get(`${origin}/api/stats.json`).then(
                        (response) => response.status(),
                        () => 0
                    );
                },
                { timeout: 30_000 }
            )
            .toBe(200);
        await page.goto(`${origin}/stats`);
        await page
            .getByRole("button", { name: "Run Analysis", exact: true })
            .click();
        await expect(
            page.getByRole("button", { name: "Re-run Analysis", exact: true })
        ).toBeVisible({ timeout: 30_000 });
        const response = await request.get(`${origin}/api/stats.json`);
        const state = (await response.json()) as StatsState;
        expect(state.status).toBe("complete");
        expect(state.report?.filesLinted).toBe(1);
        expect(state.report?.rules.map((rule) => rule.name)).toEqual(
            expect.arrayContaining([
                "stylelint/color-hex-length",
                "fixture/measured-rule",
            ])
        );
        await expect(
            page.getByText("color-hex-length", { exact: false }).first()
        ).toBeVisible();
        expect(await readFile(join(workspace, "example.css"), "utf8")).toBe(
            css
        );
        expect(await readFile(join(workspace, ".stylelintcache"), "utf8")).toBe(
            "preserve existing cache"
        );
    } finally {
        await stop(child);
        await rm(workspace, { recursive: true, force: true });
    }
});

for (const base of ["/", "/nested/inspector/"]) {
    test(`packaged static stats render at ${base}`, async ({ page }) => {
        test.setTimeout(90_000);
        const workspace = await createWorkspace();
        const output = join(workspace, "export");
        const server = createServer((request, response) => {
            void (async () => {
                const pathname = new URL(request.url ?? "/", "http://localhost")
                    .pathname;
                if (!pathname.startsWith(base)) {
                    response.writeHead(404).end();
                    return;
                }
                const relative = pathname.slice(base.length);
                const file =
                    relative === "stats" || relative === ""
                        ? "index.html"
                        : relative;
                const contents = await readFile(join(output, file));
                response
                    .writeHead(200, {
                        "Content-Type":
                            lookup(file) ?? "application/octet-stream",
                    })
                    .end(contents);
            })().catch(() => response.writeHead(404).end());
        });
        try {
            await execute(
                process.execPath,
                [
                    cli,
                    "build",
                    "--stats",
                    "--base",
                    base,
                    "--outDir",
                    output,
                ],
                { cwd: workspace, timeout: 45_000, windowsHide: true }
            );
            const serialized = await readFile(
                join(output, "api/stats.json"),
                "utf8"
            );
            const state = JSON.parse(serialized) as StatsState;
            expect(state.mode).toBe("static");
            expect(state.status).toBe("complete");
            expect(state.report?.filesLinted).toBe(1);
            expect(serialized).not.toContain(workspace.replaceAll("\\", "/"));
            expect(serialized).not.toContain(repository.replaceAll("\\", "/"));
            expect(serialized).not.toContain(
                JSON.stringify(workspace).slice(1, -1)
            );
            expect(serialized).not.toContain(
                JSON.stringify(repository).slice(1, -1)
            );
            server.listen(0, "127.0.0.1");
            await once(server, "listening");
            const address = server.address();
            if (!address || typeof address === "string")
                throw new Error("Expected TCP server address");
            await page.goto(`http://127.0.0.1:${address.port}${base}stats`);
            await expect(
                page.getByText("color-hex-length", { exact: false }).first()
            ).toBeVisible();
            await expect(
                page.getByRole("button", {
                    name: /Run Analysis|Re-run Analysis/,
                })
            ).toHaveCount(0);
            await expect(
                page.getByText(/Static snapshot/i).first()
            ).toBeVisible();
        } finally {
            if (server.listening)
                await new Promise<void>((resolveClose) =>
                    server.close(() => resolveClose())
                );
            await rm(workspace, { recursive: true, force: true });
        }
    });
}

test("static builds omit profiling by default and fail explicit invalid analyses", async () => {
    test.setTimeout(90_000);
    const workspace = await createWorkspace();
    try {
        const output = join(workspace, "export");
        await execute(
            process.execPath,
            [
                cli,
                "build",
                "--outDir",
                output,
            ],
            {
                cwd: workspace,
                timeout: 45_000,
                windowsHide: true,
            }
        );
        expect(
            JSON.parse(await readFile(join(output, "api/stats.json"), "utf8"))
        ).toEqual({ mode: "static", status: "idle", stale: false });
        await writeFile(join(workspace, "example.css"), "a { broken");
        // A malformed configuration must make an explicitly requested profile fail.
        await writeFile(
            join(workspace, "stylelint.config.mjs"),
            "export default { plugins: ['./missing-plugin.mjs'], rules: {} };"
        );
        await expect(
            execute(
                process.execPath,
                [
                    cli,
                    "build",
                    "--stats",
                    "--outDir",
                    output,
                ],
                { cwd: workspace, timeout: 45_000, windowsHide: true }
            )
        ).rejects.toThrow();
    } finally {
        await rm(workspace, { recursive: true, force: true });
    }
});
