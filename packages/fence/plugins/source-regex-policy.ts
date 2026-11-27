export interface AuditedRegex {
  readonly expression: string;
  readonly reason: string;
}

export const auditedStringRegexes: readonly AuditedRegex[] = [];
