import { createClient } from '@supabase/supabase-js';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Configuração direta do Supabase
const supabaseUrl = 'https://gfpicaytgherspvkpiis.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmcGljYXl0Z2hlcnNwdmtwaWlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzg3NzU2MSwiZXhwIjoyMDczNDUzNTYxfQ.grBXwu5DJj0ROjP5avuRPlZOIAgVIGepswGxQXTg2AM';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

async function createUsers() {
  try {
    console.log('🔐 Creating password hashes...');
    const adminPassword = await hashPassword('admin123');
    const clientPassword = await hashPassword('cliente123');

    console.log('👨‍💼 Creating admin user...');
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('users')
      .upsert({
        username: 'admin@gquicks.com',
        password: adminPassword,
        email: 'admin@gquicks.com',
        first_name: 'Administrador',
        last_name: 'Gquicks',
        role: 'SUPER_ADMIN',
        tenant_id: 'efe1464a-c543-45f6-a769-a0e1993434b0'
      }, { onConflict: 'username' });

    if (adminError) {
      console.error('❌ Admin user error:', adminError);
    } else {
      console.log('✅ Admin user created/updated');
    }

    console.log('👤 Creating client user...');
    const { data: clientUser, error: clientError } = await supabaseAdmin
      .from('users')
      .upsert({
        username: 'cliente@teste.com',
        password: clientPassword,
        email: 'cliente@teste.com',
        first_name: 'Cliente',
        last_name: 'Teste',
        role: 'CLIENT_USER',
        tenant_id: 'efe1464a-c543-45f6-a769-a0e1993434b0'
      }, { onConflict: 'username' });

    if (clientError) {
      console.error('❌ Client user error:', clientError);
    } else {
      console.log('✅ Client user created/updated');
    }

    // Verificar se os usuários foram criados
    console.log('🔍 Checking created users...');
    const { data: users, error: listError } = await supabaseAdmin
      .from('users')
      .select('username, role, id')
      .limit(10);

    if (listError) {
      console.error('❌ Error listing users:', listError);
    } else {
      console.log(`📊 Total users found: ${users?.length || 0}`);
      users?.forEach(u => console.log(`- Username: ${u.username}, Role: ${u.role}`));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createUsers().catch(console.error);