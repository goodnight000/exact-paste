import { describe, expect, it } from "vitest";
import { addressFastPath, usPlace } from "../src/address";
import { decide } from "../src/decide";
import { field } from "../eval/fields";

const letter = `hi, please send the two bowls here, not the studio.

Elena Voss
914 N Damen Ave
Chicago, IL 60622
elena@voss.studio
312-555-0198

buzzer 3B. I'm out Thursday.`;

describe("usPlace", () => {
  it("reads one US city-state-zip line and the street above it", () => {
    expect(usPlace(letter)).toEqual({
      street: "914 N Damen Ave",
      city: "Chicago",
      state: "IL",
      zip: "60622",
    });
  });
});

describe("address fast path", () => {
  it("fills city, state, zip, and street without Jev", async () => {
    const city = field("City", "text", { autocomplete: "address-level2" });
    const state = field("State", "text", { autocomplete: "address-level1" });
    const zip = field("ZIP", "text", { autocomplete: "postal-code" });
    const street = field("Street", "text", { autocomplete: "street-address" });
    expect(addressFastPath(letter, city)?.value).toBe("Chicago");
    expect(addressFastPath(letter, state)?.value).toBe("IL");
    expect(addressFastPath(letter, zip)?.value).toBe("60622");
    expect((await decide(letter, street, null)).value).toBe("914 N Damen Ave");
    expect((await decide(letter, city, null)).value).toBe("Chicago");
  });
});
