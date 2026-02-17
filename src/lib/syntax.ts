import Prism from "prismjs";

// Import additional languages (order matters due to dependencies)
// Core languages first
import "prismjs/components/prism-markup"; // Required for JSX
import "prismjs/components/prism-css";
import "prismjs/components/prism-javascript";

// Languages with dependencies
import "prismjs/components/prism-typescript"; // Depends on javascript
import "prismjs/components/prism-jsx"; // Depends on markup, javascript
import "prismjs/components/prism-tsx"; // Depends on typescript, jsx
import "prismjs/components/prism-scss"; // Depends on css
import "prismjs/components/prism-sass"; // Depends on css
import "prismjs/components/prism-less"; // Depends on css
import "prismjs/components/prism-c"; // Depends on clike
import "prismjs/components/prism-cpp"; // Depends on c
import "prismjs/components/prism-objectivec"; // Depends on c
import "prismjs/components/prism-java";
import "prismjs/components/prism-scala"; // Depends on java
import "prismjs/components/prism-kotlin"; // Depends on java
import "prismjs/components/prism-ruby"; // Depends on clike

// Independent languages
import "prismjs/components/prism-rust";
import "prismjs/components/prism-python";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-go";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-graphql";
import "prismjs/components/prism-docker";
import "prismjs/components/prism-makefile";

/**
 * Map of file extensions to Prism.js language identifiers
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  // JavaScript/TypeScript
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",

  // Web
  html: "markup",
  htm: "markup",
  xml: "markup",
  svg: "markup",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",

  // Data formats
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",

  // Systems programming
  rs: "rust",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  m: "objectivec",
  mm: "objectivec",
  go: "go",
  swift: "swift",

  // Scripting
  py: "python",
  rb: "ruby",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "bash",

  // JVM
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",

  // Other
  md: "markdown",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
};

/**
 * Map of exact file basenames to Prism.js language identifiers.
 */
const BASENAME_TO_LANGUAGE: Record<string, string> = {
  dockerfile: "docker",
  makefile: "makefile",
};

/**
 * Get the Prism.js language identifier for a file path.
 * Returns null if the language cannot be determined.
 */
export function getLanguageFromPath(filePath: string): string | null {
  const normalizedPath = filePath.toLowerCase();
  const fileName = normalizedPath.split(/[\\/]/).pop() ?? normalizedPath;

  const basenameLanguage = BASENAME_TO_LANGUAGE[fileName];
  if (basenameLanguage) {
    return basenameLanguage;
  }

  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) {
    return null;
  }

  const extension = fileName.slice(lastDot + 1);
  return EXTENSION_TO_LANGUAGE[extension] ?? null;
}

/**
 * Escape HTML entities in a string
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Highlight code using Prism.js.
 * Returns HTML string with syntax highlighting spans.
 * If language is not supported, returns escaped HTML.
 */
export function highlightCode(
  code: string | undefined | null,
  language: string | null
): string {
  // Handle undefined/null input
  if (code == null) {
    return "";
  }

  if (!(language && Prism.languages[language])) {
    return escapeHtml(code);
  }

  return Prism.highlight(code, Prism.languages[language], language);
}
