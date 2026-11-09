function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export const env = {
  supabaseUrl: () => req("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseSecret: () => req("SUPABASE_SECRET_KEY"),
  adminPin: () => req("ADMIN_PIN"),
  anthropicKey: () => process.env.ANTHROPIC_API_KEY,
  geminiKey: () => process.env.GEMINI_API_KEY,
  claudeModel: () => process.env.CLAUDE_MODEL || "claude-opus-5-5",
  geminiModel: () => process.env.GEMINI_MODEL || "gemini-flash-latest",
};
