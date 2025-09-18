import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Cliente público (com RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente administrativo (bypass RLS)
export const supabaseAdmin = supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Função para verificar conectividade
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (err) {
    console.error('❌ Failed to connect to Supabase:', err);
    return false;
  }
}

// Configuração de Storage
export const supabaseStorage = {
  bucket: 'documents',
  getPublicUrl: (path: string) => {
    const { data } = supabase.storage
      .from('documents')
      .getPublicUrl(path);
    return data.publicUrl;
  },
  upload: async (path: string, file: File | Buffer) => {
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(path, file);
    
    if (error) throw error;
    return data;
  },
  download: async (path: string) => {
    const { data, error } = await supabase.storage
      .from('documents')
      .download(path);
    
    if (error) throw error;
    return data;
  }
};