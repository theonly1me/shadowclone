export const evaluationArms = {
  bare: { context: false, profile: false },
  skills: { context: true, profile: false },
  clone: { context: true, profile: true },
} as const;

export type EvaluationArm = keyof typeof evaluationArms;

export const evaluationArmOrder = ["bare", "skills", "clone"] as const;
