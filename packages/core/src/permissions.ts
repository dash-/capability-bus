import type { AppContext, CallerIdentity, PermissionChecker } from './types.js';

export class SimplePermissionChecker implements PermissionChecker {
  check(required: string[], context: AppContext, _caller: CallerIdentity): boolean {
    return required.every((p) => context.permissions.includes(p));
  }
}
