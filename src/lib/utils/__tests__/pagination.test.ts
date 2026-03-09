import { describe, it, expect } from "vitest";
import { paginate, paginationMeta } from "../pagination";

describe("paginate", () => {
  it("returns correct skip/take for page 1", () => {
    expect(paginate(1, 20)).toEqual({ skip: 0, take: 20 });
  });

  it("returns correct skip/take for page 2", () => {
    expect(paginate(2, 20)).toEqual({ skip: 20, take: 20 });
  });

  it("returns correct skip/take for page 3 with pageSize 10", () => {
    expect(paginate(3, 10)).toEqual({ skip: 20, take: 10 });
  });

  it("handles pageSize 1", () => {
    expect(paginate(5, 1)).toEqual({ skip: 4, take: 1 });
  });
});

describe("paginationMeta", () => {
  it("calculates totalPages correctly", () => {
    expect(paginationMeta(100, 1, 20)).toEqual({
      total: 100,
      page: 1,
      pageSize: 20,
      totalPages: 5,
    });
  });

  it("rounds up totalPages for partial pages", () => {
    expect(paginationMeta(21, 1, 20)).toEqual({
      total: 21,
      page: 1,
      pageSize: 20,
      totalPages: 2,
    });
  });

  it("returns 0 totalPages for 0 total", () => {
    expect(paginationMeta(0, 1, 20)).toEqual({
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
  });

  it("returns 1 totalPage when total <= pageSize", () => {
    expect(paginationMeta(5, 1, 20).totalPages).toBe(1);
  });
});
