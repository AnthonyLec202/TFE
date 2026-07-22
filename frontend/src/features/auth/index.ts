export { AuthProvider, useAuth } from './hooks/useAuth';
export { ConsentBumpModal } from './ConsentBumpModal';
export { LoginContainer } from './LoginContainer';
export { EnrollmentContainer } from './EnrollmentContainer';
export { ForgotPasswordContainer } from './ForgotPasswordContainer';
export { ResetPasswordContainer } from './ResetPasswordContainer';
export { WelcomeContainer } from './WelcomeContainer';
// Password policy — shared with the profile feature's change-password form (consumed via this façade).
export {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HINT,
  validatePassword,
  validatePasswordConfirmation,
} from './utils/passwordValidation';
export { validateEmail } from './utils/emailValidation';