import { Router } from "express";
import { supabase } from "../lib/supabase.js";

export const usageRouter = Router();

// Constant limit of free analyses
const ANALYSIS_LIMIT = 10000;

usageRouter.get("/usage", async (_req, res) => {
    try {
        // Count the total number of records in the analyses table
        const { count, error } = await supabase
            .from("analyses")
            .select("*", { count: "exact", head: true });

        if (error) {
            console.error("Failed to fetch usage count:", error);
            return res.status(500).json({ error: "사용량 조회에 실패했습니다." });
        }

        const currentCount = count ?? 0;
        const remaining = Math.max(0, ANALYSIS_LIMIT - currentCount);

        return res.json({
            current: currentCount,
            max: ANALYSIS_LIMIT,
            remaining
        });
    } catch (error) {
        console.error("Unexpected error fetching usage:", error);
        return res.status(500).json({ error: "사용량 조회 중 오류가 발생했습니다." });
    }
});
