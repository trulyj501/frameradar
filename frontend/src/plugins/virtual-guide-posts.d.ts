// Type declaration for the virtual module
declare module "virtual:guide-posts" {
    export interface GuidePost {
        slug: string;
        title: string;
        date: string;
        description: string;
        keywords: string;
        thumbnail: string;
        content: string;
    }
    export const guidePosts: GuidePost[];
}
