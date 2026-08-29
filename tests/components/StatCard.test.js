import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StatCard from "@/components/common/StatCard.vue";

describe("StatCard.vue", () => {
  it("renders label, formatted value, and currency", () => {
    const wrapper = mount(StatCard, {
      props: {
        label: "Total Balance",
        value: 1500,
        currency: "EUR",
        color: "success",
        icon: "cash",
      },
    });

    expect(wrapper.text()).toContain("Total Balance");
    expect(wrapper.text()).toContain("1.5k EUR");
  });

  it("applies color class based on prop", () => {
    const wrapper = mount(StatCard, {
      props: {
        label: "Total Expenses",
        value: 500,
        color: "error",
      },
    });

    const valueEl = wrapper.find(".money");
    expect(valueEl.classes()).toContain("text-[#C1503A]");
  });

  it("applies icon class based on icon prop", () => {
    const wrapper = mount(StatCard, {
      props: {
        label: "Savings",
        value: 200,
        icon: "piggy-bank",
      },
    });

    const iconEl = wrapper.find("i");
    expect(iconEl.classes()).toContain("fa-piggy-bank");
  });
});
