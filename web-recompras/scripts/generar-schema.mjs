// Copia supabase/schema.sql dentro de api/_schema.js para que el instalador lo lleve consigo
import { readFileSync, writeFileSync } from 'node:fs';
const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
writeFileSync(new URL('../api/_schema.js', import.meta.url), `// Generado desde supabase/schema.sql con scripts/generar-schema.mjs. No editar a mano.\nexport default ${JSON.stringify(sql)};\n`);
