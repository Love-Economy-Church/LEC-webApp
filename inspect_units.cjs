const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://adtugmhftcjzswxtbyue.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkdHVnbWhmdGNqenN3eHRieXVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTYxMjc5MSwiZXhwIjoyMDg1MTg4NzkxfQ.YEcrEb6xFE0D2nH9EwSwuwAn6_uEsIIfPlpmQ9y9llM'; // service role

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: cells, error: ce } = await supabase
    .from('organizational_units')
    .select('id, name, order_index')
    .ilike('name', 'KB2 Cell %');

  console.log('KB2 Cells order_index:');
  cells.forEach(c => {
    console.log(`Cell: ${c.name}, order_index: ${c.order_index}`);
  });
}

run();
