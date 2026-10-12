import { expect, it } from "vitest";
import { placeToast } from "../src/toast";

it("moves wide feedback to a free corner when the form blocks nearby placements", () => {
  document.body.innerHTML = '<input id="active"><label id="form">Other fields</label><aside id="panel" data-tone="done"></aside>';
  const rect = (x: number, y: number, width: number, height: number): DOMRect =>
    ({ x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON() {} });
  const anchor = document.querySelector<HTMLInputElement>("#active")!;
  const form = document.querySelector<HTMLLabelElement>("#form")!;
  const panel = document.querySelector<HTMLElement>("#panel")!;
  anchor.getBoundingClientRect = () => rect(650, 300, 300, 40);
  form.getBoundingClientRect = () => rect(550, 40, 450, 700);
  panel.getBoundingClientRect = () => rect(0, 0, 480, 40);
  placeToast(panel, anchor);
  expect(Number.parseFloat(panel.style.left) + 480).toBeLessThan(550);
  expect(Number.parseFloat(panel.style.top)).toBeGreaterThanOrEqual(8);
});
