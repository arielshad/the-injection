import { allItems } from "@/data/feed";
import { indexMarkdown, markdownResponse } from "@/lib/markdown";

export const GET = () => markdownResponse(indexMarkdown(allItems()));
