export function passesGate(role, gateBody, appId) {
  return role === "admin" || (
    gateBody?.ok === true &&
    Array.isArray(gateBody.apps) &&
    gateBody.apps.includes(appId)
  );
}
