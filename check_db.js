const { createClient } = require('@supabase/supabase-client');
const fs = require('fs');
const path = require('path');

// Extract Supabase URL and Key from frontend/src/supabaseClient.js
const clientFile = fs.readFileSync(path.join(__dirname, 'frontend/src/supabaseClient.js'), 'utf8');
const urlMatch = clientFile.match(/const supabaseUrl = ['"](.+?)['"]/);
const keyMatch = clientFile.match(/const supabaseKey = ['"](.+?)['"]/);

if (!urlMatch || !keyMatch) {
    console.error("Could not find Supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function checkData() {
    const { data: products, error: pError } = await supabase.from('produits').select('id, name').limit(5);
    const { data: depots, error: dError } = await supabase.from('depots').select('id, name');
    
    console.log("Products (first 5):", products);
    if (pError) console.error("Products error:", pError);
    
    console.log("Depots:", depots);
    if (dError) console.error("Depots error:", dError);
}

checkData();
