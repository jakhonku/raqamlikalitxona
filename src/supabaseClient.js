import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xwvruhvdecstesetntvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dnJ1aHZkZWNzdGVzZXRudHZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTM0MDgsImV4cCI6MjA5MTEyOTQwOH0.XvocN-6feBocWnSQQlIJurz1mfjoc1B_WLI5M28fe7U';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
