import { describe, expect, it } from "vitest";
import { completeFlow, harness, WA_ID } from "./helpers.js";

describe("conversation flow", () => {
  it("first message shows the language menu", async () => {
    const h = harness();
    const [reply] = await h.text("Hi");
    expect(reply?.type).toBe("list");
    expect(await h.state()).toBe("LANGUAGE");
  });

  it("completes the whole flow and saves every section", async () => {
    const h = harness();
    await completeFlow(h);
    expect(await h.state()).toBe("REVIEW");

    const stored = await h.repo.load(WA_ID);
    expect(stored?.completed).toBe(true);
    expect(stored?.draft.details).toEqual({ firstName: "Thabo", surname: "Mokoena", area: "Soweto, Gauteng", email: null });
    expect(stored?.draft.education).toMatchObject({
      matric: "completed",
      school: "Morris Isaacson High",
      year: 2021,
      extras: [{ name: "First Aid Level 1", year: 2023 }],
    });
    expect(stored?.draft.experience).toHaveLength(1);
    expect(stored?.draft.skills).toEqual(["Customer service", "Cash handling", "Teamwork"]);
    expect(stored?.draft.references).toEqual([{ name: "Sipho Dlamini", phone: "+27825551234", relationship: "Former manager" }]);

    const review = h.last();
    expect(review.body).toContain("Thabo Mokoena");
    expect(review.body).toContain("Car wash attendant");
  });

  it("speaks isiZulu when chosen, and falls back to English (with a note) for languages not translated yet", async () => {
    const zu = harness();
    await zu.text("Sawubona");
    const [consent] = await zu.pick("lang:zu");
    expect(consent?.body).toContain("Ngaphambi");

    const st = harness();
    await st.text("Dumela");
    const replies = await st.pick("lang:st");
    expect(replies[0]?.body).toContain("Sesotho");
    expect(replies[1]?.body).toContain("Before we start");
  });

  it("accepts typed answers that match a button title", async () => {
    const h = harness();
    await h.text("Hi");
    await h.text("isiZulu");
    expect(await h.state()).toBe("CONSENT");
    await h.text("ngiyavuma");
    expect(await h.state()).toBe("DETAILS_FIRST_NAME");
  });

  it("re-asks with a hint on invalid input", async () => {
    const h = harness();
    await h.text("Hi");
    await h.pick("lang:en");
    await h.tap("consent:yes");
    const replies = await h.text("123");
    expect(replies[0]?.body).toMatch(/doesn't look right/);
    expect(await h.state()).toBe("DETAILS_FIRST_NAME");
  });

  it("asks people to type when they send a voice note", async () => {
    const h = harness();
    await h.text("Hi");
    const replies = await h.raw({ kind: "audio" });
    expect(replies[0]?.body).toMatch(/Voice notes are coming soon/);
  });

  it("declining consent stores nothing", async () => {
    const h = harness();
    await h.text("Hi");
    await h.pick("lang:en");
    await h.tap("consent:no");
    expect(await h.sessions.get(WA_ID)).toBeNull();
    expect(await h.repo.load(WA_ID)).toBeNull();
  });

  it("ignores duplicate webhook deliveries of the same message", async () => {
    const h = harness();
    await h.engine.handle({ id: "dup", from: WA_ID, timestamp: 0, input: { kind: "text", text: "Hi" } });
    await h.engine.handle({ id: "dup", from: WA_ID, timestamp: 0, input: { kind: "text", text: "Hi" } });
    expect(h.sent).toHaveLength(1);
  });

  it("skips experience for first-time job seekers", async () => {
    const h = harness();
    await h.text("Hi");
    await h.pick("lang:en");
    await h.tap("consent:yes");
    for (const t of ["Lerato", "Molefe", "Tembisa"]) await h.text(t);
    await h.tap("email:skip");
    await h.tap("matric:studying");
    await h.text("Tembisa High");
    await h.text("2027");
    await h.tap("more:done");
    const replies = await h.tap("exp:no");
    expect(replies[0]?.body).toMatch(/first job/);
    expect(await h.state()).toBe("SKILLS");
  });
});

describe("DELETE", () => {
  it("asks for confirmation, then erases the database row and the session", async () => {
    const h = harness();
    await completeFlow(h);
    await h.text("delete");
    expect(await h.state()).toBe("DELETE_CONFIRM");
    await h.tap("del:yes");
    expect(await h.repo.load(WA_ID)).toBeNull();
    expect(await h.sessions.get(WA_ID)).toBeNull();
    expect(h.repo.deletions).toEqual([WA_ID]);
  });

  it("cancelling returns to where the user was", async () => {
    const h = harness();
    await h.text("Hi");
    await h.pick("lang:en");
    await h.tap("consent:yes");
    await h.text("Thabo");
    await h.text("SUSA"); // isiZulu keyword works too
    await h.tap("del:no");
    expect(await h.state()).toBe("DETAILS_SURNAME");
    expect(await h.repo.load(WA_ID)).not.toBeNull();
  });
});

describe("EDIT", () => {
  it("replaces only the chosen section and returns to review", async () => {
    const h = harness();
    await completeFlow(h);
    await h.text("EDIT");
    expect(await h.state()).toBe("EDIT_MENU");
    await h.pick("edit:skills");
    expect(await h.state()).toBe("SKILLS");
    await h.text("Driving, Cooking");
    expect(await h.state()).toBe("REVIEW");

    const stored = await h.repo.load(WA_ID);
    expect(stored?.draft.skills).toEqual(["Driving", "Cooking"]);
    expect(stored?.draft.experience).toHaveLength(1); // untouched
  });

  it("is not available before consent", async () => {
    const h = harness();
    await h.text("Hi");
    const replies = await h.text("edit");
    expect(replies[0]?.body).toMatch(/finish the first steps/);
    expect(await h.state()).toBe("LANGUAGE");
  });
});

describe("session recovery", () => {
  it("rebuilds the session from the database if Redis forgot it", async () => {
    const h = harness();
    await completeFlow(h);
    await h.sessions.delete(WA_ID); // simulate TTL expiry
    await h.text("edit");
    expect(await h.state()).toBe("EDIT_MENU");
  });
});
