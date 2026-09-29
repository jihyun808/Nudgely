// pages/auth/consents.ts
export interface Consents {
  agreedToTerms: boolean;
  agreedToPrivacy: boolean;
  isOver14: boolean;
  agreedToMarketing: boolean;
}

export const EMPTY_CONSENTS: Consents = {
  agreedToTerms: false,
  agreedToPrivacy: false,
  isOver14: false,
  agreedToMarketing: false,
};

/** 필수 셋이 모두 켜졌는지. 하나라도 빠지면 서버가 가입을 거부한다 */
export function hasRequiredConsents(value: Consents): boolean {
  return value.agreedToTerms && value.agreedToPrivacy && value.isOver14;
}
