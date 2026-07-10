import { createClient } from '@supabase/supabase-js'; 
const supabaseUrl = process.env.VITE_SUPABASE_URL; 
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; 
const supabase = createClient(supabaseUrl, supabaseKey); 
async function dropColumns() { 
  const { error: error1 } = await supabase.rpc('exec_sql', { sql_query: 'ALTER TABLE people DROP COLUMN IF EXISTS original_id;' }); 
  const { error: error2 } = await supabase.rpc('exec_sql', { sql_query: 'ALTER TABLE organizational_units DROP COLUMN IF EXISTS original_id;' }); 
  if (error1) console.error('Error dropping from people:', error1); 
  if (error2) console.error('Error dropping from units:', error2); 
  console.log('Columns dropped (if rpc enabled). If not, please run SQL manually.'); 
} 
dropColumns();
