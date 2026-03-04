import { createClient } from "@supabase/supabase-js";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
    console.log("Deleting all records from 'analyses' table...");
    const { error } = await supabase
        .from("analyses")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Successfully deleted all test records.");
    }
}

run();
