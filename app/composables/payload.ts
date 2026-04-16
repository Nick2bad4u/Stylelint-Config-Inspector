/* eslint-disable no-console */
import type {
    ErrorInfo,
    FilesGroup,
    FlatConfigItem,
    MatchedFile,
    Payload,
    ResolvedPayload,
    RuleConfigStates,
    RuleInfo,
} from "~~/shared/types";
import { $fetch } from "ofetch";
import { computed, ref } from "vue";
import {
    DEFAULT_WORKSPACE_SCAN_GLOBS,
    isGeneralConfig,
    isIgnoreOnlyConfig,
} from "~~/shared/configs";
import {
    getRuleLevel,
    getRuleOptions,
    getRulePrimaryOption,
} from "~~/shared/rules";
import { configsOpenState, fileGroupsOpenState } from "./state";

const LOG_NAME = "[Config Inspector]";

/**
 * Initial skeleton payload used before the first fetch completes. All required
 * fields of {@link Payload} and {@link PayloadMeta} are satisfied with empty/zero
 * values so we never need to cast.
 */
const INITIAL_PAYLOAD: Payload = {
    rules: {},
    configs: [],
    meta: {
        lastUpdate: 0,
        basePath: "",
        configPath: "",
    },
};

const data = ref<Payload>(INITIAL_PAYLOAD);

/**
 * State of initial loading
 */
export const isLoading = ref(true);
/**
 * State of fetching, used for loading indicator
 */
export const isFetching = ref(false);
/**
 * Error information
 */
export const errorInfo = ref<ErrorInfo>();

function isErrorInfo(payload: Payload | ErrorInfo): payload is ErrorInfo {
    return "error" in payload;
}

async function get(baseURL: string) {
    isFetching.value = true;
    const payload = await $fetch<Payload | ErrorInfo>("/api/payload.json", {
        baseURL,
    });
    if (isErrorInfo(payload)) {
        errorInfo.value = payload;
        isLoading.value = false;
        isFetching.value = false;
        return;
    }
    errorInfo.value = undefined;
    data.value = payload;
    isLoading.value = false;
    isFetching.value = false;
    console.log(LOG_NAME, "Config payload", payload);
    return payload;
}

let _promise: Promise<Payload | undefined> | undefined;

export function init(baseURL: string) {
    if (_promise) return;
    _promise = get(baseURL).then((payload) => {
        if (!payload) return;

        if (typeof payload.meta.wsPort === "number") {
            // Connect to WebSocket, listen for config changes
            const ws = new WebSocket(
                `ws://${location.hostname}:${payload.meta.wsPort}`
            );
            ws.addEventListener("message", async (event) => {
                console.log(LOG_NAME, "WebSocket message", event.data);
                const payload = JSON.parse(event.data);
                if (payload.type === "config-change") get(baseURL);
            });
            ws.addEventListener("open", () => {
                console.log(LOG_NAME, "WebSocket connected");
            });
            ws.addEventListener("close", () => {
                console.log(LOG_NAME, "WebSocket closed");
            });
            ws.addEventListener("error", (error) => {
                console.error(LOG_NAME, "WebSocket error", error);
            });
        }

        return payload;
    });
}

export function ensureDataFetch() {
    return _promise;
}

export const payload = computed(() =>
    Object.freeze(resolvePayload(data.value))
);

export function getRuleFromName(name: string): RuleInfo {
    return (
        payload.value.rules[name] ||
        ({
            name,
            invalid: true,
        } as RuleInfo)
    );
}

export function getRuleDefaultOptions(name: string): unknown[] {
    return payload.value.rules[name]?.defaultOptions ?? [];
}

export function getRuleStates(name: string): RuleConfigStates | undefined {
    return payload.value.ruleToState.get(name);
}

function ensureMappedArrayValue<K, V>(map: Map<K, V[]>, key: K): V[] {
    const existing = map.get(key);
    if (existing) return existing;

    const created: V[] = [];
    map.set(key, created);
    return created;
}

function ensureMappedSetValue<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
    const existing = map.get(key);
    if (existing) return existing;

    const created = new Set<V>();
    map.set(key, created);
    return created;
}

function appendRuleStatesForConfig(
    config: FlatConfigItem,
    configIndex: number,
    ruleToState: Map<string, RuleConfigStates>
): void {
    if (!config.rules) return;

    for (const [name, raw] of Object.entries(config.rules)) {
        const level = getRuleLevel(raw);
        if (!level) continue;

        ensureMappedArrayValue(ruleToState, name).push({
            name,
            configIndex,
            level,
            primaryOption: getRulePrimaryOption(raw),
            options: getRuleOptions(raw),
        });
    }
}

function appendGlobMappingsForConfig(
    config: FlatConfigItem,
    globToConfigs: Map<string, FlatConfigItem[]>
): void {
    const globs = [
        ...(config.files?.flat() ?? []),
        ...(config.ignores?.flat() ?? []),
    ];
    for (const glob of globs)
        ensureMappedArrayValue(globToConfigs, glob).push(config);
}

function syncConfigsOpenState(configCount: number): void {
    const isCollapsedByDefault = configCount >= 10;
    configsOpenState.value = Array.from<boolean>({ length: configCount }).fill(
        !isCollapsedByDefault
    );
}

export function resolvePayload(payload: Payload): ResolvedPayload {
    const ruleToState = new Map<string, RuleConfigStates>();
    const globToConfigs = new Map<string, FlatConfigItem[]>();
    const extendsInfoMap = new Map(
        (payload.extendsInfo ?? []).map(
            (entry) => [entry.specifier, entry] as const
        )
    );

    payload.configs.forEach((config, index) => {
        appendRuleStatesForConfig(config, index, ruleToState);
        appendGlobMappingsForConfig(config, globToConfigs);
    });

    // Collapse all if there are too many items.
    syncConfigsOpenState(payload.configs.length);

    return {
        ...payload,
        configsIgnoreOnly: payload.configs.filter((i) => isIgnoreOnlyConfig(i)),
        configsGeneral: payload.configs.filter((i) => isGeneralConfig(i)),
        extendsInfoMap,
        ruleToState,
        globToConfigs,
        filesResolved: resolveFiles(payload),
    };
}

// ─── FileIndexes ──────────────────────────────────────────────────────────────

interface FileIndexes {
    files: string[];
    globToFiles: Map<string, Set<string>>;
    fileToGlobs: Map<string, Set<string>>;
    fileToConfigs: Map<string, Set<number>>;
    configToFiles: Map<number, Set<string>>;
}

/**
 * Iterates {@link Payload.files} once and builds all four cross-index maps plus
 * the flat file list. Each iteration is O(globs + configs) per file.
 */
function buildFileIndexes(payload: Payload): FileIndexes {
    const files: string[] = [];
    const globToFiles = new Map<string, Set<string>>();
    const fileToGlobs = new Map<string, Set<string>>();
    const fileToConfigs = new Map<string, Set<number>>();
    const configToFiles = new Map<number, Set<string>>();

    for (const file of payload.files ?? []) {
        files.push(file.filepath);
        for (const glob of file.globs) {
            ensureMappedSetValue(globToFiles, glob).add(file.filepath);
            ensureMappedSetValue(fileToGlobs, file.filepath).add(glob);
        }
        for (const configIndex of file.configs) {
            ensureMappedSetValue(configToFiles, configIndex).add(file.filepath);
            ensureMappedSetValue(fileToConfigs, file.filepath).add(configIndex);
        }
    }

    return { files, globToFiles, fileToGlobs, fileToConfigs, configToFiles };
}

/**
 * Computes the stable group ID for a matched file. Files that share the same
 * set of special configs (or the same sorted positive globs when there are
 * none) land in the same display group.
 */
function computeMatchedGroupId(payload: Payload, file: MatchedFile): string {
    const specialConfigs = file.configs.filter(
        (i) => !isGeneralConfig(payload.configs[i]!)
    );
    if (specialConfigs.length > 0) return `configs:${specialConfigs.join("-")}`;

    const positiveGlobs = file.globs
        .filter((glob) => !glob.startsWith("!"))
        .toSorted((a, b) => a.localeCompare(b));
    return `globs:${positiveGlobs.join("|") || "<general>"}`;
}

/**
 * Populates {@link filesGroupMap} with a "matched" group entry for every file in
 * {@link Payload.files}.
 */
function buildMatchedFileGroups(
    payload: Payload,
    filesGroupMap: Map<string, FilesGroup>
): void {
    for (const file of payload.files ?? []) {
        const groupId = computeMatchedGroupId(payload, file);
        if (!filesGroupMap.has(groupId)) {
            const displayConfigs = [...new Set(file.configs)].toSorted(
                (a, b) => a - b
            );
            filesGroupMap.set(groupId, {
                id: groupId,
                kind: "matched",
                files: [],
                configs: displayConfigs.map((i) => payload.configs[i]!),
                globs: new Set<string>(),
            });
        }
        const group = filesGroupMap.get(groupId)!;
        group.files.push(file.filepath);
        file.globs.forEach((g) => group.globs.add(g));
    }
}

/**
 * Handles a single declared positive glob that belongs to a config but has no
 * matched files. Creates or updates a "declared" group in
 * {@link filesGroupMap}.
 */
function processUnmatchedDeclaredGlob(
    glob: string,
    config: FlatConfigItem,
    globToFiles: Map<string, Set<string>>,
    filesGroupMap: Map<string, FilesGroup>
): void {
    ensureMappedSetValue(globToFiles, glob);
    if ((globToFiles.get(glob)?.size ?? 0) > 0) return;

    const groupId = `declared-glob:${glob}`;
    if (!filesGroupMap.has(groupId)) {
        filesGroupMap.set(groupId, {
            id: groupId,
            kind: "declared",
            files: [],
            configs: [],
            globs: new Set<string>([glob]),
        });
    }
    const group = filesGroupMap.get(groupId)!;
    if (!group.configs.includes(config)) group.configs.push(config);
}

/**
 * Iterates every config's declared positive globs and, for those without any
 * matched files, adds a "declared" group entry via
 * {@link processUnmatchedDeclaredGlob}.
 */
function buildDeclaredGlobGroups(
    payload: Payload,
    globToFiles: Map<string, Set<string>>,
    filesGroupMap: Map<string, FilesGroup>
): void {
    for (const config of payload.configs) {
        const declaredPositiveGlobs = (config.files ?? [])
            .flat()
            .filter(
                (glob) => typeof glob === "string" && !glob.startsWith("!")
            );
        for (const glob of declaredPositiveGlobs)
            processUnmatchedDeclaredGlob(
                glob,
                config,
                globToFiles,
                filesGroupMap
            );
    }
}

/**
 * For each default workspace-scan glob that has no matched files, adds a
 * "default" group entry referencing all general (non-ignore-only) configs.
 */
function buildDefaultScanGroups(
    payload: Payload,
    globToFiles: Map<string, Set<string>>,
    filesGroupMap: Map<string, FilesGroup>
): void {
    const generalConfigs = payload.configs.filter(
        (config) => isGeneralConfig(config) && !isIgnoreOnlyConfig(config)
    );
    if (!generalConfigs.length) return;

    for (const glob of DEFAULT_WORKSPACE_SCAN_GLOBS) {
        ensureMappedSetValue(globToFiles, glob);
        if ((globToFiles.get(glob)?.size ?? 0) > 0) continue;

        const groupId = `default-scan:${glob}`;
        if (!filesGroupMap.has(groupId)) {
            filesGroupMap.set(groupId, {
                id: groupId,
                kind: "default",
                files: [],
                configs: [...generalConfigs],
                globs: new Set<string>([glob]),
            });
        }
    }
}

/**
 * Converts the raw {@link Set}<number> config-index map to the final sorted
 * {@link FlatConfigItem}[] map expected by {@link ResolvedPayload}.
 */
function buildFinalFileToConfigs(
    fileToConfigs: Map<string, Set<number>>,
    payload: Payload
): Map<string, FlatConfigItem[]> {
    return new Map(
        Array.from(fileToConfigs.entries(), ([file, configs]) => [
            file,
            [...configs]
                .toSorted((a, b) => a - b)
                .map((i) => payload.configs[i]!),
        ])
    );
}

function resolveFiles(payload: Payload): ResolvedPayload["filesResolved"] {
    if (!payload.files) return undefined;

    const { files, globToFiles, fileToGlobs, fileToConfigs, configToFiles } =
        buildFileIndexes(payload);

    const filesGroupMap = new Map<string, FilesGroup>();
    buildMatchedFileGroups(payload, filesGroupMap);
    buildDeclaredGlobGroups(payload, globToFiles, filesGroupMap);
    buildDefaultScanGroups(payload, globToFiles, filesGroupMap);

    const groups = [...filesGroupMap.values()];
    fileGroupsOpenState.value = groups.map(() => true);

    return {
        list: files,
        globToFiles,
        fileToGlobs,
        fileToConfigs: buildFinalFileToConfigs(fileToConfigs, payload),
        configToFiles,
        groups,
    };
}
