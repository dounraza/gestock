import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientFile = fs.readFileSync(path.join(__dirname, 'src/supabaseClient.js'), 'utf8');
const urlMatch = clientFile.match(/const supabaseUrl = ['"](.+?)['"]/);
const keyMatch = clientFile.match(/const supabaseKey = ['"](.+?)['"]/);

if (!urlMatch || !keyMatch) {
    console.error("Could not find Supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function checkStock() {
    const { data: depots } = await supabase.from('depots').select('id, name');
    console.log("Depots:", depots);
    
    if (depots && depots.length > 0) {
        // Take the first depot ID
        const depotId = depots[0].id;
        const { data: stocks, error } = await supabase.from('stocks').select('*').eq('depot_id', depotId).limit(5);
        console.log("Stocks for depot", depots[0].name, ":", stocks);
        if (error) console.error("Error:", error);
    }
}

checkStock();
