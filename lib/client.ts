export async function requestProvider<T>(endpoint: string, message: object, read?: (response: Response) => Promise<T>): Promise<T> {
  const response = await fetch(`/api/${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new Error(result?.error ?? 'The service couldn’t respond.')
  }
  return read ? read(response) : response.json()
}
