export const USER_NAME = "ridit"

export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 5) return "good night"
  if (hour < 12) return "good morning"
  if (hour < 18) return "good afternoon"
  return "good evening"
}
