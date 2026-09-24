import { describe, expect, it } from "vitest";
import { SessionEpoch } from "./session-epoch";

describe("SessionEpoch", () => {
  it("cada troca de sessão invalida o número anterior", () => {
    const epoch = new SessionEpoch();
    const sessionA = epoch.advance();
    expect(epoch.isCurrent(sessionA)).toBe(true);

    epoch.advance(); // logout de A
    const sessionB = epoch.advance(); // login de B

    expect(epoch.isCurrent(sessionA)).toBe(false);
    expect(epoch.isCurrent(sessionB)).toBe(true);
    expect(epoch.current).toBe(sessionB);
  });
});
