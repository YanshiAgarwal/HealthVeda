/**
 * Password rules (based on NIST SP 800-63B):
 *  - 8 to 128 characters, at least one letter and one number
 *  - not a well-known leaked password
 *  - must not contain your email name or your own name
 */
const COMMON = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890", "qwerty123",
  "iloveyou1", "admin123", "welcome1", "letmein1", "abc12345", "passw0rd", "india123",
  "healthveda1", "qwertyuiop1", "11111111", "monkey123", "dragon123", "football1",
]);

export function passwordProblems(password, { email = "", name = "" } = {}) {
  const lower = password.toLowerCase();
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 128) return "Password must be at most 128 characters.";
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) return "Use at least one letter and one number.";
  if (COMMON.has(lower)) return "This password is too common. Please choose another.";
  const emailName = email.split("@")[0]?.toLowerCase();
  if (emailName && emailName.length >= 4 && lower.includes(emailName)) return "Password must not contain your email.";
  const firstName = name.trim().split(/\s+/)[0]?.toLowerCase();
  if (firstName && firstName.length >= 4 && lower.includes(firstName)) return "Password must not contain your name.";
  return null;
}
