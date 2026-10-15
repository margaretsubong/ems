/**
 * Mock Authentication Service
 *
 * This module contains all mock authentication logic.
 * Replace these functions with actual Supabase calls when integrating the backend.
 */

// Simulated delay to mimic network requests
function delay(ms: number = 1000): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Mock Data ---

const MOCK_EMPLOYEES = [
  {
    employeeId: "EMP-001",
    email: "john.doe@company.com",
    activated: false,
  },
  {
    employeeId: "EMP-002",
    email: "jane.smith@company.com",
    activated: true,
  },
  {
    employeeId: "EMP-003",
    email: "margaret.subong@company.com",
    activated: false,
  },
];

// --- Types ---

export interface VerifyAccountResult {
  success: boolean;
  error?: string;
}

export interface SetupAccountResult {
  success: boolean;
  error?: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

export interface ForgotPasswordResult {
  success: boolean;
  error?: string;
}

export interface ResetPasswordResult {
  success: boolean;
  error?: string;
}

// --- Mock Functions ---

/**
 * Mock login verification.
 * Replace with Supabase signInWithPassword.
 */
export async function mockLogin(
  email: string,
  _password: string
): Promise<LoginResult> {
  await delay(1200);

  const employee = MOCK_EMPLOYEES.find((e) => e.email === email);

  if (!employee) {
    return { success: false, error: "Invalid email or password." };
  }

  if (!employee.activated) {
    return {
      success: false,
      error: "Your account has not been activated. Please activate your account first.",
    };
  }

  // Mock successful login
  return { success: true };
}

/**
 * Mock employee account verification.
 * Replace with Supabase/backend employee lookup.
 */
export async function mockVerifyAccount(
  employeeId: string,
  email: string
): Promise<VerifyAccountResult> {
  await delay(1500);

  const employee = MOCK_EMPLOYEES.find(
    (e) => e.employeeId === employeeId && e.email === email
  );

  if (!employee) {
    return {
      success: false,
      error: "Employee information not found. Please check your Employee ID and email.",
    };
  }

  if (employee.activated) {
    return {
      success: false,
      error: "This account has already been activated. Please sign in instead.",
    };
  }

  return { success: true };
}

/**
 * Mock account setup (set username and password).
 * Replace with Supabase user creation / update.
 */
export async function mockSetupAccount(
  _username: string,
  _password: string
): Promise<SetupAccountResult> {
  await delay(1500);

  // Always succeed for mock
  return { success: true };
}

/**
 * Mock forgot password flow.
 * Replace with Supabase resetPasswordForEmail.
 */
export async function mockForgotPassword(
  email: string
): Promise<ForgotPasswordResult> {
  await delay(1200);

  // Check if email looks valid (exists in mock data)
  const employee = MOCK_EMPLOYEES.find((e) => e.email === email);

  if (!employee) {
    // For security, still return success to avoid email enumeration
    return { success: true };
  }

  return { success: true };
}

/**
 * Mock reset password flow.
 * Replace with Supabase updateUser password.
 */
export async function mockResetPassword(
  _newPassword: string
): Promise<ResetPasswordResult> {
  await delay(1200);

  return { success: true };
}
