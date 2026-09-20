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
});
