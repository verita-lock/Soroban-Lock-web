/**
 * Validates required environment variables at startup.
 * Logs a warning for any that are missing or malformed.
 * Safe to call in both server and client contexts.
 */
export function validateEnv(): void {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  if (!apiUrl) {
    console.warn(
      '[Soroban Guard] NEXT_PUBLIC_API_URL is not set. Defaulting to http://localhost:3001. ' +
        'Set this variable in .env.local for production use.',
    )
    return
  }

  try {
    new URL(apiUrl)
  } catch {
    console.warn(
      `[Soroban Guard] NEXT_PUBLIC_API_URL is malformed: "${apiUrl}". ` +
        'Expected a valid URL (e.g. https://api.example.com).',
    )
  }
}
