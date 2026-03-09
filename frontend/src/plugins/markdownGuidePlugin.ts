import { Plugin } from "vite";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { fileURLToPath } from "url";

const VIRTUAL_MODULE_ID = "virtual:guide-posts";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

export interface GuidePost {
    slug: string;
    title: string;
    date: string;
    description: string;
    keywords: string;
    thumbnail: string;
    content: string;
}

function readGuidePosts(contentDir: string): GuidePost[] {
    if (!fs.existsSync(contentDir)) {
        console.warn(`[markdownGuidePlugin] Content directory not found: ${contentDir}`);
        return [];
    }

    const files = fs.readdirSync(contentDir).filter((f) => f.endsWith(".md"));

    const posts: GuidePost[] = files.map((file) => {
        const raw = fs.readFileSync(path.join(contentDir, file), "utf-8");
        const { data, content } = matter(raw);

        return {
            slug: data.slug || file.replace(/\.md$/, ""),
            title: data.title || "",
            date: data.date ? String(data.date) : "",
            description: data.description || "",
            keywords: data.keywords || "",
            thumbnail: data.thumbnail || "",
            content,
        };
    });

    // Sort by date descending
    posts.sort((a, b) => (a.date < b.date ? 1 : -1));

    return posts;
}

export function markdownGuidePlugin(contentDir?: string): Plugin {
    let resolvedContentDir: string;

    return {
        name: "vite-plugin-markdown-guide",
        configResolved(config) {
            // If caller passes an absolute path, use it directly.
            // Otherwise derive from the Vite project root → content/guide
            resolvedContentDir = contentDir
                ? path.resolve(contentDir)
                : path.resolve(config.root, "content/guide");
            console.log(`[markdownGuidePlugin] Content dir: ${resolvedContentDir}`);
        },
        resolveId(id) {
            if (id === VIRTUAL_MODULE_ID) {
                return RESOLVED_VIRTUAL_MODULE_ID;
            }
        },
        load(id) {
            if (id === RESOLVED_VIRTUAL_MODULE_ID) {
                const posts = readGuidePosts(resolvedContentDir);
                console.log(`[markdownGuidePlugin] Loaded ${posts.length} posts`);
                return `export const guidePosts = ${JSON.stringify(posts)};`;
            }
        },
        handleHotUpdate({ file, server }) {
            if (file.includes("content/guide") && file.endsWith(".md")) {
                const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
                if (mod) {
                    server.moduleGraph.invalidateModule(mod);
                    server.ws.send({ type: "full-reload" });
                }
            }
        },
    };
}
