export const configSummarySlotCount = 7;

export const testIds = {
    nav: {
        tabs: "nav-tabs",
        configsLink: "nav-link-configs",
        rulesLink: "nav-link-rules",
        extendsLink: "nav-link-extends",
        filesLink: "nav-link-files",
        statsLink: "nav-link-stats",
        devLink: "nav-link-dev",
    },
    configs: {
        summaryGrid: "config-summary-grid",
        summaryItem: "config-summary-item",
    },
    files: {
        viewListButton: "files-view-list-button",
        viewGroupsButton: "files-view-groups-button",
        matchedListDetails: "files-matched-list-details",
        matchedListSummary: "files-matched-list-summary",
        groupIdentityLabel: "files-group-identity-label",
    },
    extends: {
        specifierButton: "extends-specifier-button",
        rulesListContainer: "extends-rules-list-container",
    },
    stats: {
        runButton: "stats-run-button",
        summary: "stats-summary",
        ruleRow: "stats-rule-row",
        pluginRow: "stats-plugin-row",
        status: "stats-status",
    },
} as const;

export const orderedNavLinkTestIds = [
    testIds.nav.configsLink,
    testIds.nav.rulesLink,
    testIds.nav.extendsLink,
    testIds.nav.filesLink,
    testIds.nav.statsLink,
    testIds.nav.devLink,
] as const;
