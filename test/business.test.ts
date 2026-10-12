import { describe, expect, it } from "vitest";
import { amounts, businessFastPath, dueDates, invoiceNumbers, orgNames } from "../src/business";
import { decide } from "../src/decide";
import { field } from "../eval/fields";

const bill = `Please pay Norr Press LLC.

Invoice INV-8841
Amount due: 1240.00
Due: 12 May 2026

Remit to:
88 Bond Street
Brooklyn, NY 11222
United States

pay@norr.press
`;

describe("business extractors", () => {
  it("pulls invoice id, org, amount, and due date out of prose", () => {
    expect(invoiceNumbers(bill)).toEqual(["INV-8841"]);
    expect(orgNames(bill)).toEqual(["Norr Press LLC"]);
    expect(amounts(bill)).toEqual(["1240.00"]);
    expect(dueDates(bill)).toEqual(["12 May 2026"]);
  });
});

describe("business fast path", () => {
  it("never supplies an invoice number or due date as the invoice date", async () => {
    const target = field("Invoice date", "text");
    expect(businessFastPath("Invoice INV-8841\nPayment due 20 November 2026", target)).toBeNull();
    expect(businessFastPath("Payment due 20 November 2026", target)).toBeNull();
    expect((await decide("Invoice date: 3 November 2026", target, null)).value).toBe("3 November 2026");
  });
  it("fills vendor and invoice number without Jev", async () => {
    const vendor = field("Vendor", "text", { autocomplete: "organization" });
    const invoice = field("Invoice number", "text", { name: "invoice" });
    expect(businessFastPath(bill, vendor)).toEqual({ value: "Norr Press LLC", reason: "one-org" });
    expect(businessFastPath(bill, invoice)).toEqual({ value: "INV-8841", reason: "one-invoice" });
    expect((await decide(bill, vendor, null)).value).toBe("Norr Press LLC");
    expect((await decide(bill, invoice, null)).value).toBe("INV-8841");
  });
});

describe("labelled company lines", () => {
  const note = "Name: Nia Okonkwo\nCompany: Hybrid Audio\nTitle: Staff Sound Designer";

  it("drops the label from a Company: line", () => {
    expect(orgNames(note)).toEqual(["Hybrid Audio"]);
  });

  it("does not put the company in a title field", () => {
    const title = field("Current title", "text", { autocomplete: "organization-title" });
    expect(businessFastPath(note, title)).toBeNull();
  });
});
