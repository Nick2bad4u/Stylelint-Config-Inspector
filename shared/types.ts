export type GlobPattern = string;

export type RuleEntry = unknown;
export type RulesRecord = Record<string, RuleEntry>;

export interface FlatConfigItem extends Record<string, unknown> {
    index: number;
    name?: string;
    files?: GlobPattern[];
    ignores?: GlobPattern[];
    rules?: RulesRecord;
    plugins?: Record<string, unknown>;
    extends?: string[];
    customSyntax?: string;
}

export interface StylelintIgnoreInfo {
    path: string;
    patterns: string[];
}

export type ExtendsInfoSource = "package" | "local" | "unknown";

export interface ExtendsInfo {
    specifier: string;
    packageName?: string;
    description?: string;
    docsUrl?: string;
    docsUrlSource?: RuleDocsUrlSource;
    source: ExtendsInfoSource;
    directExtends?: string[];
    plugins?: string[];
    customSyntax?: string;
    ruleCount?: number;
    rules?: string[];
    usedByConfigIndexes: number[];
}

export type RuleLevel = "off" | "warn" | "error";

export interface Payload {
    configs: FlatConfigItem[];
    rules: Record<string, RuleInfo>;
    meta: PayloadMeta;
    diagnostics?: string[];
    files?: MatchedFile[];
    extendsInfo?: ExtendsInfo[];
}

export interface ResolvedPayload extends Payload {
    configsIgnoreOnly: FlatConfigItem[];
    configsGeneral: FlatConfigItem[];
    extendsInfoMap: Map<string, ExtendsInfo>;

    ruleToState: Map<string, RuleConfigStates>;
    globToConfigs: Map<string, FlatConfigItem[]>;

    /**
     * Resolved data from files Undefined if users disabled glob matching
     */
    filesResolved?: {
        list: string[];
        globToFiles: Map<string, Set<string>>;
        configToFiles: Map<number, Set<string>>;
        fileToGlobs: Map<string, Set<string>>;
        fileToConfigs: Map<string, FlatConfigItem[]>;
        groups: FilesGroup[];
    };
}

export interface MatchedFile {
    /**
     * Filepath
     */
    filepath: string;
    /**
     * Matched globs, includes both positive and negative globs
     */
    globs: string[];
    /**
     * Matched configs indexes
     */
    configs: number[];
}

export interface ErrorInfo {
    error: string;
    message?: string;
}

export interface FilesGroup {
    id: string;
    kind: "matched" | "declared" | "default";
    files: string[];
    configs: FlatConfigItem[];
    globs: Set<string>;
}

export interface PayloadMeta {
    wsPort?: number;
    engine?: "stylelint";
    targetFilePath?: string;
    configNotFound?: boolean;
    lastUpdate: number;
    basePath: string;
    configPath: string;
    stylelintIgnore?: StylelintIgnoreInfo;
}

export type RuleDescriptionSource = "meta" | "message" | "generated";
export type RuleDocsUrlSource = "meta" | "inferred";

export interface RuleInfo {
    name: string;
    plugin: string;
    pluginPackageName?: string;
    docs?: {
        description?: string;
        descriptionSource?: RuleDescriptionSource;
        descriptionMissing?: boolean;
        recommended?: boolean;
        url?: string;
        urlSource?: RuleDocsUrlSource;
    };
    schema?: unknown;
    messages?: Record<string, string>;
    defaultOptions?: unknown[];
    fixable?: boolean | string;
    deprecated?:
        | boolean
        | {
              message?: string;
              deprecatedSince?: string;
              availableUntil?: string;
              url?: string;
              replacedBy?: Array<{
                  rule?: {
                      name?: string;
                      url?: string;
                  };
                  plugin?: {
                      name?: string;
                      url?: string;
                  };
              }>;
          };
    /**
     * The rule may be removed
     */
    invalid?: boolean;
}

export interface FiltersConfigsPage {
    rule?: string;
    filepath?: string;
    plugins?: string[];
}

export interface RuleConfigState {
    name: string;
    configIndex: number;
    level: RuleLevel;
    primaryOption?: unknown;
    options?: unknown[];
}

export type RuleConfigStates = RuleConfigState[];
