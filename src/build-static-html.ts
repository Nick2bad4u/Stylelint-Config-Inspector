const RE_ABSOLUTE_ASSET_ATTR = /\s(href|src)="\//g;
const RE_IMPORTMAP_ENTRY = /("#entry"\s*:\s*")\/_nuxt\//g;

export function rewriteStaticHtmlWithBase(
    content: string,
    baseURL: string
): string {
    if (baseURL === "/") return content;

    return content
        .replaceAll(RE_ABSOLUTE_ASSET_ATTR, ` $1="${baseURL}`)
        .replaceAll('baseURL:"/"', `baseURL:"${baseURL}"`)
        .replaceAll(RE_IMPORTMAP_ENTRY, `$1${baseURL}_nuxt/`);
}
