export const configSummarySlotCount = 7;

export const testIds = {
    nav: {
        tabs: "nav-tabs",
        configsLink: "nav-link-configs",
        rulesLink: "nav-link-rules",
        extendsLink: "nav-link-extends",
        filesLink: "nav-link-files",
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
} as const;

export const orderedNavLinkTestIds = [
    testIds.nav.configsLink,
    testIds.nav.rulesLink,
    testIds.nav.extendsLink,
    testIds.nav.filesLink,
    testIds.nav.devLink,
] as const;
