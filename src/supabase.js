import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = "https://prqhuxhwxpfiweyitqhd.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBycWh1eGh3eHBmaXdleWl0cWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTY2NTgsImV4cCI6MjA4Nzg5MjY1OH0.FWmib0oF1R5nTGOb5w9v2ezC2-v5CoPmR3sDC1ltgbs";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);