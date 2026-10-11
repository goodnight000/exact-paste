import { describe, expect, it } from "vitest";
import { describeField, isSlot } from "../src/field";

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

describe("isSlot", () => {
  it("treats a labelled email input as a slot", () => {
    mount(`<form><label>Email <input id="e" type="email" /></label></form>`);
    expect(isSlot(document.querySelector("#e"))).toBe(true);
    expect(describeField(document.querySelector("#e") as HTMLInputElement).kind).toBe("email");
  });

  it("treats a job-app name field as a slot", () => {
    mount(`<form><label for="n">Full name</label><input id="n" type="text" name="name" /></form>`);
    expect(isSlot(document.querySelector("#n"))).toBe(true);
  });

  it("ignores password, search, and comment boxes", () => {
    mount(`
      <form>
        <input id="p" type="password" />
        <input id="s" type="search" placeholder="Search" />
        <textarea id="c" placeholder="Leave a comment"></textarea>
      </form>
    `);
    expect(isSlot(document.querySelector("#p"))).toBe(false);
    expect(isSlot(document.querySelector("#s"))).toBe(false);
    expect(isSlot(document.querySelector("#c"))).toBe(false);
  });

  it("ignores unlabeled text outside a form", () => {
    mount(`<input id="x" type="text" />`);
    expect(isSlot(document.querySelector("#x"))).toBe(false);
  });

  it("treats a professional summary textarea as a slot", () => {
    mount(`<form><label>Professional summary <textarea id="bio"></textarea></label></form>`);
    expect(isSlot(document.querySelector("#bio"))).toBe(true);
  });

  it("ignores contenteditable", () => {
    mount(`<div id="t" contenteditable="true">hello</div>`);
    expect(isSlot(document.querySelector("#t"))).toBe(false);
  });

  it("accepts a labelled arbitrary application question", () => {
    mount('<form><label for="q">Why did you pick this idea?</label><textarea id="q" placeholder="Write up to 500 words"></textarea></form>');
    const el = document.querySelector<HTMLTextAreaElement>("#q")!;
    expect(isSlot(el)).toBe(true);
    expect(describeField(el).label).toBe("Why did you pick this idea?");
  });

  it("accepts a custom labelled text field inside a form", () => {
    mount('<form><label>Referral code<input id="referral" name="referral_code"></label><label>Preferred language<input id="language"></label></form>');
    expect(isSlot(document.getElementById("referral"))).toBe(true);
    expect(isSlot(document.getElementById("language"))).toBe(true);
  });

  it("ignores a disabled fieldset, invisible parent, and numeric control", () => {
    mount('<fieldset disabled><input type="email" id="disabled"></fieldset><div style="display:none"><input type="email" id="hidden"></div><label>Amount<input type="number" id="number"></label>');
    for (const id of ["disabled", "hidden", "number"]) expect(isSlot(document.getElementById(id))).toBe(false);
  });

  it("does not mistake a comment containing the word email for a stored value", () => {
    mount('<form><label>Email comments<textarea id="comments"></textarea></label></form>');
    expect(isSlot(document.getElementById("comments"))).toBe(false);
  });

  it("keeps sensitive placeholder checks separate from the primary label", () => {
    mount('<label>Phone<input id="otp" type="tel" placeholder="One-time verification code"></label><label>Full name<input id="card" placeholder="Cardholder name"></label>');
    expect(isSlot(document.getElementById("otp"))).toBe(false);
    expect(isSlot(document.getElementById("card"))).toBe(false);
  });

  it("reads an accessible label inside an open shadow root", () => {
    mount('<div id="host"></div>');
    const root = document.getElementById("host")!.attachShadow({ mode: "open" });
    root.innerHTML = '<span id="label">LinkedIn URL</span><input type="url" aria-labelledby="label">';
    const el = root.querySelector<HTMLInputElement>("input")!;
    expect(describeField(el).label).toBe("LinkedIn URL");
    expect(isSlot(el)).toBe(true);
  });

  it("accepts a labelled application textarea in a web component inside a form", () => {
    mount('<form><div id="host"></div></form>');
    const root = document.getElementById("host")!.attachShadow({ mode: "open" });
    root.innerHTML = '<label>Why did you pick this idea?<textarea></textarea></label>';
    expect(isSlot(root.querySelector("textarea"))).toBe(true);
  });
});
