import sharedConfig from "stylelint-config-nick2bad4u";

/** @type {import("stylelint").Config} */
const stylelintConfig = {
    ...sharedConfig,
    overrides: [
        ...(sharedConfig.overrides ?? []),
        {
            customSyntax: "postcss-html",
            files: ["**/*.vue"],
        },
    ],
};

export default stylelintConfig;
