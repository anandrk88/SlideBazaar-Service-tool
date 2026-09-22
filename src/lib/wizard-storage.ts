/**
 * Storage keys and the endpoint for the wizard tracker.
 *
 * Split out of useWizardTracker because withdrawing consent happens outside the
 * wizard: somebody can reject the banner on "/", where the wizard never mounts,
 * and their rows still have to be deleted.
 */
export const ATTEMPT_KEY = "sb-wz-attempt-v1";
export const VISITOR_KEY = "sb-wz-visitor-v1";
export const WIZARD_ENDPOINT = "/api/wizard-attempt";
