/**
 * User validation utilities
 */

export interface User {
  username: string;
  email: string;
  age: number;
  password: string;
}

/**
 * Validates a username
 * Username must be 3-20 characters and alphanumeric
 */
export function validateUsername(username: string): boolean {
  if (!username) return false;
  if (username.length < 3 || username.length > 20) return false;
  return /^[a-zA-Z0-9_]+$/.test(username);
}

/**
 * Validates an email address
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates age (must be 18 or older)
 */
export function validateAge(age: number): boolean {
  return age >= 18 && age <= 150;
}

/**
 * Validates password strength
 * Password must be at least 8 characters and contain uppercase, lowercase, and number
 */
export function validatePassword(password: string): boolean {
  if (!password || password.length < 8) return false;
  
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  return hasUpperCase && hasLowerCase && hasNumber;
}

/**
 * Validates an entire user object
 */
export function validateUser(user: User): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!validateUsername(user.username)) {
    errors.push('Invalid username');
  }

  if (!validateEmail(user.email)) {
    errors.push('Invalid email');
  }

  if (!validateAge(user.age)) {
    errors.push('Invalid age');
  }

  if (!validatePassword(user.password)) {
    errors.push('Invalid password');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
